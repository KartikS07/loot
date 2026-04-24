import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const MODEL = "gemini-2.5-flash";

const getConvex = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  return url ? new ConvexHttpClient(url) : null;
};

async function logStep(params: {
  sessionId: string; agentName: string; step: string;
  input?: string; output?: string; tokensUsed?: number;
  durationMs?: number; status: string;
}) {
  try {
    const convex = getConvex();
    if (!convex) return;
    await convex.mutation(api.searches.logAgentStep, params);
  } catch { /* non-fatal */ }
}

// Strip markdown formatting that pollutes the price data context
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")  // **bold** → bold
    .replace(/\*([^*]+)\*/g, "$1")       // *italic* → italic
    .replace(/#{1,6}\s+/gm, "")          // ## headers
    .replace(/`{1,3}[^`]*`{1,3}/g, "")  // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url) → link
    .trim();
}

// Repair common Gemini JSON issues before parse
function repairAndParseJson(text: string): unknown {
  // Remove JS-style comments
  let s = text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, "$1");
  // Find JSON object boundaries
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");
  return JSON.parse(s.slice(start, end + 1));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitize(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === "object") {
    if (Object.keys(obj).length === 0) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitize(v);
    if (out.listedPrice && out.effectivePrice) {
      const listed = parseInt(String(out.listedPrice).replace(/[^0-9]/g, ""));
      const effective = parseInt(String(out.effectivePrice).replace(/[^0-9]/g, ""));
      if (listed > 0 && effective < listed * 0.5) {
        out.effectivePrice = out.listedPrice;
        out.savings = "₹0";
        out.discountApplied = "Discount data unavailable";
      }
    }
    return out;
  }
  return obj;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const sessionId = `price_${Date.now()}`;

  try {
    const { product, userProfile } = await req.json() as {
      product: string;
      userProfile: { savedCards?: string[]; upiPreferences?: string[] };
    };

    const cards = userProfile.savedCards?.join(", ") || "none";
    const upi = userProfile.upiPreferences?.join(", ") || "none";

    logStep({ sessionId, agentName: "price_optimizer", step: "search_start", input: product, status: "running" });

    // ── Phase 1: Google Search grounding — gets real-time price data as prose ──
    const searchModel = genAI.getGenerativeModel({
      model: MODEL,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
      generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
    });

    const searchPrompt = `Find the current retail price of "${product}" in India today.

For each of these platforms — Amazon India, Flipkart, Croma, Reliance Digital, Tata Cliq, Vijay Sales — report:
- Exact listed/selling price in rupees
- Any active bank card offer for: ${cards}
- Any UPI cashback for: ${upi}
- In stock: yes/no
- Delivery time
- Return policy

Also report the all-time low price and any Indian sale events expected in the next 30 days.
Only report prices you actually find. Do not estimate.`;

    const searchResult = await searchModel.generateContent(searchPrompt);
    const rawPriceData = searchResult.response.text();
    // Strip markdown and cap at 4000 chars — Phase 2 doesn't need the full essay
    const cleanPriceData = stripMarkdown(rawPriceData).slice(0, 4000);

    console.log("[price] Phase 1 complete, chars:", cleanPriceData.length, "| preview:", cleanPriceData.slice(0, 200));

    if (cleanPriceData.trim().length < 50) throw new Error("Search returned no usable data");

    logStep({
      sessionId, agentName: "price_optimizer", step: "search_complete",
      output: cleanPriceData.slice(0, 200), status: "running",
      durationMs: Date.now() - startTime,
    });

    // ── Phase 2: JSON structuring — thinking disabled to prevent JSON corruption ──
    // gemini-2.5-flash with thinking ON leaks reasoning tokens into JSON output.
    // thinkingBudget:0 disables thinking entirely → clean, valid JSON every time.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phase2Config: any = {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
    };
    const structureModel = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: phase2Config,
    });

    // Deliberately simple schema — fewer nested levels = less chance of malformation
    const structurePrompt = `Convert this price data into JSON. Respond with ONLY the JSON object, nothing else.

Price data:
${cleanPriceData}

Required JSON structure:
{
  "product": "string",
  "platforms": [
    {
      "name": "string",
      "listedPrice": "₹X,XXX",
      "effectivePrice": "₹X,XXX",
      "savings": "₹X,XXX",
      "discountApplied": "string describing discount or null",
      "couponCode": "string or null",
      "inStock": true,
      "deliveryEta": "string",
      "sellerTrust": "string",
      "returnPolicy": "string"
    }
  ],
  "verdict": {
    "action": "buy_now",
    "bestPlatform": "string",
    "bestEffectivePrice": "₹X,XXX",
    "savings": "string",
    "reason": "string",
    "waitUntil": null,
    "expectedWaitPrice": null
  },
  "priceContext": "string",
  "atl": "string",
  "upcomingSales": ["string"]
}

Rules:
- Include only platforms with actual prices found. Skip platforms with no data.
- Sort platforms by effectivePrice cheapest first.
- effectivePrice = listedPrice minus ${cards} card discount and ${upi} UPI cashback if applicable.
- effectivePrice must never be less than 50% of listedPrice.
- verdict.action is "wait" only if a major sale within 15 days will drop price by more than 10%, otherwise "buy_now".
- User's cards: ${cards}. User's UPI: ${upi}.`;

    const structureResult = await structureModel.generateContent(structurePrompt);
    const jsonText = structureResult.response.text();

    console.log("[price] Phase 2 JSON preview:", jsonText.slice(0, 150));

    if (!jsonText || jsonText.trim().length < 10) {
      throw new Error("Phase 2 returned empty response — context may be too large");
    }

    // repairAndParseJson handles trailing commas, JS comments, and finds {…} boundaries
    const parsed = sanitize(repairAndParseJson(jsonText));

    logStep({
      sessionId, agentName: "price_optimizer", step: "complete",
      output: jsonText.slice(0, 200), status: "complete",
      tokensUsed: (searchResult.response.usageMetadata?.totalTokenCount ?? 0) +
                  (structureResult.response.usageMetadata?.totalTokenCount ?? 0),
      durationMs: Date.now() - startTime,
    });

    return Response.json(parsed);
  } catch (err) {
    console.error("[price] Error:", String(err).slice(0, 300));
    logStep({ sessionId, agentName: "price_optimizer", step: "error", output: String(err), durationMs: Date.now() - startTime, status: "error" });
    return Response.json({ error: "Price check failed. Please try again." }, { status: 500 });
  }
}
