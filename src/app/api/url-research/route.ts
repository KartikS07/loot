import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MODEL = "gemini-2.5-flash";
const MAX_URL_LENGTH = 2000;

/**
 * URL → product extractor.
 *
 * Strategy: try cheap host-specific URL parsing FIRST (Amazon ASIN, Flipkart
 * itemId, Croma productId). If we get a clean product identifier from the URL
 * itself, use it — bypass Gemini entirely. This is deterministic and fast.
 *
 * Fall back to Gemini for unknown hosts or URL shapes that don't yield a clean
 * identifier. Gemini is wrapped in a retry-once on parse failure to dampen the
 * cold-call flakiness we observed in prod.
 */

const SYSTEM_PROMPT = `You are a URL-to-product extractor for Indian e-commerce sites.

Given a product page URL, extract the product's canonical name and brand from the URL path / slug / query parameters.

You MUST respond with ONLY a valid JSON object. No markdown. No explanation. No text outside the JSON.

Schema:
{
  "productName": "Brand + Model + key identifier (e.g. 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones')",
  "brand": "Just the brand name (e.g. 'Sony')",
  "confidence": 0.0 to 1.0
}

Rules:
- productName: a clean, searchable product name. Include brand + model number + one or two descriptive words. Remove marketing fluff like "(Black)", "2024 Edition", "Pack of 1", platform-specific variant IDs.
- Always return SOMETHING reasonable in productName even if confidence is low — the caller decides whether to use it.
- confidence: 0.9+ for clear brand + model visible in slug; 0.6-0.9 if some guessing; below 0.5 if URL is a category page or too ambiguous.
- Do NOT fabricate model numbers that aren't hinted at by the URL.`;

function isValidProductUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  if (typeof raw !== "string") return { ok: false, reason: "URL must be a string" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "URL is empty" };
  if (trimmed.length > MAX_URL_LENGTH) return { ok: false, reason: "URL too long" };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http:// and https:// URLs are allowed" };
  }

  return { ok: true, url };
}

type Extracted = {
  productName: string;
  brand: string | null;
  confidence: number;
  source: "amazon-asin" | "flipkart-itemid" | "croma-id" | "gemini" | "gemini-retry";
  platformHint?: string;       // canonical platform name when we know it
  productUrl?: string;         // canonical URL when extracted from path
};

/**
 * Extract product info directly from the URL path. Deterministic, instant,
 * no LLM. Handles the three platforms most people paste from.
 */
function extractFromUrlPath(u: URL): Extracted | null {
  const host = u.host.toLowerCase();

  // Amazon India: /dp/{ASIN} or /gp/product/{ASIN}
  if (host.includes("amazon.in") || host.includes("amazon.com")) {
    const asinMatch = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      const asin = asinMatch[1].toUpperCase();
      // Path slug usually contains the human-readable name BEFORE the /dp/ token.
      // e.g. /Sony-WH-1000XM6-Headphones-Microphones-Studio-Quality/dp/B0F3PT1VBL
      const beforeDp = u.pathname.split(/\/(?:dp|gp\/product)\//i)[0];
      const slugTokens = beforeDp.split("/").filter(Boolean).pop() ?? "";
      const slugName = slugTokens.replace(/-/g, " ").replace(/\s+/g, " ").trim();
      const productName = slugName || `Amazon product ${asin}`;
      const brand = slugName.split(" ")[0] || null;
      return {
        productName,
        brand,
        confidence: slugName ? 0.95 : 0.7,
        source: "amazon-asin",
        platformHint: "Amazon India",
        productUrl: `https://www.amazon.in/dp/${asin}`,
      };
    }
  }

  // Flipkart: /[slug]/p/{itemId}
  if (host.includes("flipkart.com")) {
    const fkMatch = u.pathname.match(/\/([^/]+)\/p\/([a-z0-9]+)/i);
    if (fkMatch) {
      const slugName = fkMatch[1].replace(/-/g, " ").replace(/\s+/g, " ").trim();
      const itemId = fkMatch[2];
      return {
        productName: slugName || `Flipkart product ${itemId}`,
        brand: slugName.split(" ")[0] || null,
        confidence: slugName ? 0.95 : 0.7,
        source: "flipkart-itemid",
        platformHint: "Flipkart",
        productUrl: `https://www.flipkart.com/${fkMatch[1]}/p/${itemId}`,
      };
    }
  }

  // Croma: /[slug]/p/{numericId}
  if (host.includes("croma.com")) {
    const crMatch = u.pathname.match(/\/([^/]+)\/p\/(\d+)/i);
    if (crMatch) {
      const slugName = crMatch[1].replace(/-/g, " ").replace(/\s+/g, " ").trim();
      const productId = crMatch[2];
      return {
        productName: slugName || `Croma product ${productId}`,
        brand: slugName.split(" ")[0] || null,
        confidence: slugName ? 0.9 : 0.65,
        source: "croma-id",
        platformHint: "Croma",
        productUrl: `https://www.croma.com/${crMatch[1]}/p/${productId}`,
      };
    }
  }

  return null;
}

/**
 * Try Gemini once. On JSON parse failure, retry once with a stricter "respond
 * with valid JSON only" reminder. Cold-call adherence is non-deterministic;
 * one retry catches most flakes without doubling latency in the happy path.
 */
async function geminiExtract(
  cleanUrl: string,
  host: string,
): Promise<{ productName: string; brand: string | null; confidence: number; source: "gemini" | "gemini-retry" } | null> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 512,
      temperature: 0.1,
    },
  });

  const prompt = `URL: ${cleanUrl}\nHost: ${host}\n\nExtract product name + brand + confidence. Respond with JSON only.`;

  const tryOnce = async (
    extraReminder: string,
  ): Promise<{ productName: string; brand: string | null; confidence: number } | null> => {
    const result = await model.generateContent(prompt + extraReminder);
    const text = result.response.text();
    console.log("[url-research] Gemini response preview:", text.slice(0, 200));
    let parsed: { productName?: string; brand?: string; confidence?: number };
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    const productName = typeof parsed.productName === "string" ? parsed.productName.trim() : "";
    if (!productName) return null;
    return {
      productName,
      brand: typeof parsed.brand === "string" ? parsed.brand : null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  };

  const first = await tryOnce("");
  if (first) return { ...first, source: "gemini" };

  console.warn("[url-research] First Gemini call yielded no usable JSON — retrying once");
  const second = await tryOnce("\n\nReminder: respond with valid JSON only — no prose, no markdown.");
  if (second) return { ...second, source: "gemini-retry" };

  return null;
}

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const body = (await req.json()) as { url?: unknown };
    const rawUrl = typeof body?.url === "string" ? body.url : "";

    const validation = isValidProductUrl(rawUrl);
    if (!validation.ok) {
      return Response.json(
        { error: "invalid_url", message: validation.reason },
        { status: 400 },
      );
    }

    const cleanUrl = validation.url.toString();

    // ── Path 1: deterministic URL-pattern extraction (Amazon / Flipkart / Croma) ──
    const fromPath = extractFromUrlPath(validation.url);
    if (fromPath) {
      console.log(`[url-research] Direct extraction from ${fromPath.source}:`, fromPath.productName);
      return Response.json({
        productName: fromPath.productName,
        brand: fromPath.brand,
        confidence: fromPath.confidence,
        platformHint: fromPath.platformHint,
        productUrl: fromPath.productUrl,
        source: fromPath.source,
        durationMs: Date.now() - startTime,
      });
    }

    // ── Path 2: Gemini fallback (with retry) for unknown hosts / shapes ──
    const fromGemini = await geminiExtract(cleanUrl, validation.url.host);
    if (fromGemini && fromGemini.productName) {
      // Lower confidence threshold from 0.5 → 0.35. False negatives were the
      // main UX problem: rejecting a perfectly-good "Sony WH-1000XM6" parse
      // just because Gemini self-rated it as 0.45 isn't worth the friction.
      // Caller will still see the actual confidence in the response.
      if (fromGemini.confidence < 0.35) {
        return Response.json(
          {
            error: "could_not_parse",
            message: "Couldn't read that URL — try searching by name instead.",
            confidence: fromGemini.confidence,
          },
          { status: 422 },
        );
      }
      return Response.json({
        productName: fromGemini.productName,
        brand: fromGemini.brand,
        confidence: fromGemini.confidence,
        source: fromGemini.source,
        durationMs: Date.now() - startTime,
      });
    }

    return Response.json(
      {
        error: "could_not_parse",
        message: "Couldn't read that URL — try searching by name instead.",
      },
      { status: 422 },
    );
  } catch (err) {
    console.error("[url-research] Error:", err);
    return Response.json(
      {
        error: "server_error",
        message: "Couldn't read that URL — try searching by name instead.",
      },
      { status: 500 },
    );
  }
}
