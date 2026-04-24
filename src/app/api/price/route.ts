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

    const searchPrompt = `Find the CURRENT SELLING PRICE of "${product}" in India right now.

CRITICAL: I need the price a customer actually pays today — NOT the MRP or crossed-out original price.
On Flipkart/Amazon the selling price is the large number shown (e.g. ₹71,000), not the strikethrough MRP (e.g. ₹85,000).
If you see both, always report the LOWER current selling price, not the higher MRP.

For each platform — Amazon India, Flipkart, Croma, Reliance Digital, Tata Cliq, Vijay Sales — report:
1. Current selling price (the price the user pays today, NOT MRP)
2. Whether it is IN STOCK: set true if the platform shows a price and an Add to Cart / Buy Now button. Set false ONLY if the page explicitly says "Out of Stock", "Currently Unavailable", or "Sold Out". When in doubt, assume in stock.
3. The direct product page URL on that platform (e.g. flipkart.com/product-name/p/itemid)
4. Any bank card offer for: ${cards}
5. Any UPI cashback for: ${upi}
6. Delivery time
7. Return policy

Also report: all-time low price, and any Indian sale events in the next 30 days.
Only report data you find from actual search results. Do not guess or estimate.`;

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
      "listedPrice": "₹X,XXX — the current selling price a user pays today (NOT the MRP)",
      "effectivePrice": "₹X,XXX — after card/UPI discount applied",
      "savings": "₹X,XXX",
      "discountApplied": "string or null",
      "couponCode": "string or null",
      "inStock": true,
      "deliveryEta": "string",
      "sellerTrust": "string",
      "returnPolicy": "string",
      "productUrl": "direct product page URL found in search data, or null if not found"
    }
  ],
  "verdict": {
    "action": "buy_now",
    "bestPlatform": "string",
    "bestEffectivePrice": "₹X,XXX",
    "buyUrl": "direct URL to buy on best platform — same as productUrl of the best platform",
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
- listedPrice = the current discounted selling price (the number users pay). NEVER use MRP. If you see ₹71,000 and ₹85,000 for the same platform, use ₹71,000.
- inStock = true if the platform shows a live price (assume purchasable). Set false ONLY when search data explicitly says "out of stock", "unavailable", or "sold out".
- productUrl = paste the actual product page URL from the search data. If multiple URLs found, use the most specific one. If not found, set null.
- Include only platforms with actual prices. Skip platforms with no data.
- Sort platforms by effectivePrice ascending.
- effectivePrice = listedPrice minus applicable ${cards} discount and ${upi} cashback.
- effectivePrice must never be less than 80% of listedPrice (cap discount at 20%).
- verdict.action = "wait" only if a confirmed sale within 15 days will drop price >10%, otherwise "buy_now".`;

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
