import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

// Two Gemini calls + optional Rainforest — needs up to 120s on Vercel
export const maxDuration = 120;

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s+/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

function repairAndParseJson(text: string): unknown {
  let s = text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");

  let json = s.slice(start, end + 1);
  // Strip all raw control chars (including \n inside strings)
  json = json.replace(/[\x00-\x1F\x7F]/g, "");
  // Remove trailing commas
  json = json.replace(/,(\s*[}\]])/g, "$1");
  // Add missing commas between adjacent values/properties
  json = json.replace(/(["}\]0-9]|true|false|null)(\s*)("|\{|\[)/g, "$1,$3");

  try {
    return JSON.parse(json);
  } catch (e) {
    const m = (e as Error).message.match(/position (\d+)/);
    if (m) {
      const pos = parseInt(m[1]);
      console.log("[price] JSON error at pos", pos, "context:", JSON.stringify(json.slice(Math.max(0, pos - 40), pos + 40)));
    }
    throw e;
  }
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

// ── Rainforest API — accurate real-time Amazon India prices ──
interface RainforestResult {
  price: string;
  title: string;
  link: string;
  rating?: string;
  inStock: boolean;
}

async function fetchAmazonPrice(product: string): Promise<RainforestResult | null> {
  const apiKey = process.env.RAINFOREST_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL("https://api.rainforestapi.com/request");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("type", "search");
    url.searchParams.set("amazon_domain", "amazon.in");
    url.searchParams.set("search_term", product);
    url.searchParams.set("page", "1");

    const res = await withTimeout(fetch(url.toString()), 15000, "Rainforest API");
    if (!res.ok) {
      console.warn("[price] Rainforest API error:", res.status);
      return null;
    }

    const data = await res.json();
    const results = data?.search_results ?? [];
    if (!results.length) return null;

    // Score each result by word overlap with the product name.
    // Uses word-set matching (not substring) so "buds" won't match "earbuds",
    // and keeps short numeric tokens (e.g. "5" distinguishes "Air 5" from "Air 7").
    const productTokens = product.toLowerCase()
      .replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length >= 1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const withPrices = results.filter((r: any) => typeof r.price?.value === "number");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scored = withPrices.map((r: any) => {
      const titleWords = new Set(
        String(r.title ?? "").toLowerCase().replace(/[^a-z0-9]/g, " ").split(/\s+/).filter(w => w.length >= 1)
      );
      const hits = productTokens.filter(t => titleWords.has(t)).length;
      return { r, score: hits / productTokens.length };
    }).sort((a: { r: unknown; score: number }, b: { r: unknown; score: number }) => b.score - a.score);

    const match = scored[0]?.r ?? null;
    if (!match) return null;

    console.log(`[price] Rainforest best match: "${String(match.title).slice(0, 50)}" score=${scored[0].score.toFixed(2)} price=₹${match.price?.value}`);

    const priceVal = (match.price as Record<string, unknown>)?.value;
    const priceStr = priceVal ? `₹${Math.round(Number(priceVal)).toLocaleString("en-IN")}` : null;
    if (!priceStr) return null;

    return {
      price: priceStr,
      title: String(match.title ?? product),
      link: String(match.link ?? `https://www.amazon.in/s?k=${encodeURIComponent(product)}`),
      rating: match.rating ? String(match.rating) : undefined,
      inStock: match.availability?.type !== "out_of_stock",
    };
  } catch (err) {
    console.warn("[price] Rainforest fetch failed:", String(err).slice(0, 100));
    return null;
  }
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

    // ── Run Rainforest + Phase 1 in parallel ──
    const [amazonData, searchResult] = await Promise.allSettled([
      fetchAmazonPrice(product),
      withTimeout(
        genAI.getGenerativeModel({
          model: MODEL,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [{ googleSearch: {} } as any],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
        }).generateContent(`Find the CURRENT SELLING PRICE of "${product}" in India right now.

Use targeted searches for each platform. Search these specific queries:
- site:flipkart.com "${product}" to find the Flipkart listing price
- site:croma.com "${product}" to find the Croma price
- site:reliancedigital.in "${product}" for Reliance Digital
- site:tatacliq.com "${product}" for Tata Cliq

CRITICAL: Report the CURRENT SELLING PRICE (what a buyer pays today), NOT the MRP/strikethrough price.

For each platform found, report:
1. Current selling price in rupees (the actual checkout price)
2. In stock status (true unless page explicitly says out of stock)
3. Any bank card discount for: ${cards}
4. Any UPI cashback for: ${upi}
5. Delivery time
6. Return policy

Also report: all-time low price for this product, and Indian sale events expected in the next 30 days.
Only report data you find from actual platform pages. Do not guess.`),
        75000,
        "Phase 1 search"
      ),
    ]);

    const amazonResult = amazonData.status === "fulfilled" ? amazonData.value : null;
    const rawPriceData = searchResult.status === "fulfilled"
      ? stripMarkdown(searchResult.value.response.text()).slice(0, 4000)
      : "";

    console.log("[price] Rainforest Amazon:", amazonResult ? amazonResult.price : "not available");
    console.log("[price] Phase 1 chars:", rawPriceData.length);

    // Build the context for Phase 2: Rainforest data takes precedence for Amazon
    let amazonContext = "";
    if (amazonResult) {
      const amazonCards = userProfile.savedCards?.includes("HDFC") ? " (apply HDFC 10% discount if applicable)" : "";
      amazonContext = `\n\nACCURATE AMAZON INDIA DATA (use this, it is real-time from Amazon's API):
- Platform: Amazon India
- Current selling price: ${amazonResult.price}${amazonCards}
- In stock: ${amazonResult.inStock}
- Direct link available: yes
- Product match: ${amazonResult.title}`;
    }

    const combinedContext = amazonContext + (rawPriceData ? `\n\nAdditional platform data from web search:\n${rawPriceData}` : "");

    if (!combinedContext.trim() || combinedContext.trim().length < 20) {
      throw new Error("No price data available from any source");
    }

    logStep({
      sessionId, agentName: "price_optimizer", step: "search_complete",
      output: combinedContext.slice(0, 200), status: "running",
      durationMs: Date.now() - startTime,
    });

    // ── Phase 2: JSON structuring — thinking disabled ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phase2Config: any = {
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
    };
    const structureModel = genAI.getGenerativeModel({ model: MODEL, generationConfig: phase2Config });

    const structurePrompt = `Convert this price data into JSON. Respond with ONLY the JSON object, nothing else.

Price data:
${combinedContext}

Required JSON structure:
{
  "product": "string",
  "platforms": [
    {
      "name": "string",
      "listedPrice": "₹X,XXX",
      "effectivePrice": "₹X,XXX",
      "savings": "₹X,XXX",
      "discountApplied": "string or null",
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
- listedPrice = the CURRENT SELLING PRICE (what buyer pays). NEVER use MRP. Prefer lower price if two are shown.
- If "ACCURATE AMAZON INDIA DATA" is provided above, use EXACTLY that price for Amazon India. Do not change it.
- inStock = true if platform shows a live price. Set false ONLY if explicitly marked out of stock.
- Include only platforms with actual prices found. Sort by effectivePrice ascending.
- effectivePrice = listedPrice minus applicable ${cards} card discount and ${upi} cashback.
- effectivePrice must never be less than 80% of listedPrice.
- verdict.action = "wait" only if a confirmed sale within 15 days will drop price >10%, otherwise "buy_now".`;

    const structureResult = await withTimeout(
      structureModel.generateContent(structurePrompt),
      30000,
      "Phase 2 structure"
    );
    const jsonText = structureResult.response.text();

    console.log("[price] Phase 2 JSON preview:", jsonText.slice(0, 150));

    if (!jsonText || jsonText.trim().length < 10) {
      throw new Error("Phase 2 returned empty response");
    }

    const parsed = sanitize(repairAndParseJson(jsonText));

    logStep({
      sessionId, agentName: "price_optimizer", step: "complete",
      output: jsonText.slice(0, 200), status: "complete",
      durationMs: Date.now() - startTime,
    });

    return Response.json(parsed);
  } catch (err) {
    console.error("[price] Error:", String(err).slice(0, 300));
    logStep({ sessionId, agentName: "price_optimizer", step: "error", output: String(err), durationMs: Date.now() - startTime, status: "error" });
    return Response.json({ error: "Price check failed. Please try again." }, { status: 500 });
  }
}
