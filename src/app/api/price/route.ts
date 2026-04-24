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

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in response");
  return text.slice(start, end + 1);
}

const PRICE_SYSTEM_PROMPT = `You are Loot's Price Optimizer — India's sharpest price intelligence agent. Your job: find the real effective price of a product across all major Indian platforms after applying the user's bank card and UPI discounts.

Use your search capability to find current prices on Amazon India, Flipkart, Croma, Reliance Digital, Tata Cliq, Vijay Sales, Blinkit, and the brand's official India website.

Respond with ONLY a valid JSON object. No markdown, no explanation, no text outside JSON.

JSON schema:
{
  "product": "Full product name with model",
  "searchedAt": "today's date",
  "platforms": [
    {
      "name": "platform name",
      "listedPrice": "₹XX,XXX",
      "effectivePrice": "₹XX,XXX",
      "savings": "₹X,XXX",
      "discountApplied": "HDFC 10% off + coupon SAVE10 = ₹X,XXX off",
      "couponCode": "code or null",
      "inStock": true,
      "deliveryEta": "Tomorrow / 2-3 days / Same day etc",
      "sellerTrust": "Brand authorized / Marketplace seller",
      "returnPolicy": "10-day / 7-day / No return"
    }
  ],
  "verdict": {
    "action": "buy_now" | "wait",
    "bestPlatform": "platform name",
    "bestEffectivePrice": "₹XX,XXX",
    "savings": "₹X,XXX saved vs market average",
    "reason": "clear 1-2 sentence reason for buy_now or wait",
    "waitUntil": "date or event name if action=wait, else null",
    "expectedWaitPrice": "₹XX,XXX if waiting makes sense, else null"
  },
  "priceContext": "1-2 sentences on whether current price is good historically",
  "atl": "All-time low: ₹XX,XXX on [platform] in [month year] — or 'Not enough data'",
  "upcomingSales": ["sale name and approximate date if known"]
}

Rules:
- Search for actual current prices. Do not make up prices.
- platforms array: include all platforms where you find the product in stock. Sort by effectivePrice ascending.
- effectivePrice = listedPrice minus all applicable discounts for this user's cards/UPI.
- If a platform is out of stock, still include it with inStock: false and effectivePrice = listedPrice.
- verdict.action = "wait" only if a major sale is within 15 days AND historical discount is >10%.
- Be decisive. Users need a clear answer, not "it depends".
- If you cannot find prices for a platform, omit it rather than guessing.`;

export async function POST(req: Request) {
  const startTime = Date.now();
  const sessionId = `price_${Date.now()}`;

  try {
    const { product, userProfile } = await req.json() as {
      product: string;
      userProfile: {
        persona?: string;
        savedCards?: string[];
        upiPreferences?: string[];
      };
    };

    const profileContext = `\nUser's payment instruments for discount calculation:
- Bank cards: ${userProfile.savedCards?.join(", ") || "none specified"}
- UPI apps: ${userProfile.upiPreferences?.join(", ") || "none"}
Apply ONLY discounts applicable to these specific cards/UPI apps. If no cards specified, show base price only.`;

    logStep({ sessionId, agentName: "price_optimizer", step: "start", input: product, status: "running" });

    // Price optimizer uses Google Search grounding for real-time data
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: PRICE_SYSTEM_PROMPT + profileContext,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.1, // Very low temp for factual price data
      },
    });

    const prompt = `Find current prices for: ${product}

Search Amazon India, Flipkart, Croma, Reliance Digital, Tata Cliq, and other major Indian platforms right now.
Apply the user's bank card discounts (${userProfile.savedCards?.join(", ") || "none"}) and UPI cashback (${userProfile.upiPreferences?.join(", ") || "none"}) to compute effective prices.
Give a decisive buy-now-or-wait verdict.

Return ONLY the JSON object.`;

    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    console.log("[price] Raw response preview:", rawText.slice(0, 200));

    const jsonStr = extractJson(rawText);
    const parsed = JSON.parse(jsonStr);

    logStep({
      sessionId, agentName: "price_optimizer", step: "complete",
      output: jsonStr.slice(0, 300),
      tokensUsed: result.response.usageMetadata?.totalTokenCount,
      durationMs: Date.now() - startTime, status: "complete",
    });

    return Response.json(parsed);
  } catch (err) {
    console.error("[price] Error:", err);
    logStep({ sessionId, agentName: "price_optimizer", step: "error", output: String(err), durationMs: Date.now() - startTime, status: "error" });
    return Response.json({ error: "Price check failed. Please try again.", }, { status: 500 });
  }
}
