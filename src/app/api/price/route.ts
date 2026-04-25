import { GoogleGenerativeAI } from "@google/generative-ai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { extractDirectLinks } from "@/lib/platform-urls";
import * as priceCache from "@/lib/price-cache";
import { KNOWN_PLATFORMS, canonicalPlatform, filterPlatforms } from "@/lib/platforms";

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
  const s = text.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
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

// Gemini occasionally emits price strings with stray trailing commas or whitespace
// (e.g. "₹1,494,"). Strip them here so the UI doesn't render them.
const PRICE_FIELDS = new Set([
  "listedPrice",
  "effectivePrice",
  "savings",
  "bestEffectivePrice",
  "expectedWaitPrice",
  "price",
  "totalPrice",
  "unitPrice",
]);

function cleanPriceString(s: string): string {
  return s
    .trim()
    .replace(/[,\s]+$/g, "")  // drop trailing commas/whitespace ("₹1,494," -> "₹1,494")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitize(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (obj !== null && typeof obj === "object") {
    if (Object.keys(obj).length === 0) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = sanitize(v);
      out[k] = PRICE_FIELDS.has(k) && typeof cleaned === "string" ? cleanPriceString(cleaned) : cleaned;
    }
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
  directLink: string;  // amazon.in/dp/{ASIN} — direct product page, no search
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
    // Uses word-set matching: "buds" won't match "earbuds",
    // numeric tokens kept so "5" distinguishes "Air 5" from "Air 7".
    // Accessories (replacement filters, cases, cables) are heavily penalised.
    const ACCESSORY_WORDS = new Set([
      "replacement", "filter", "refill", "case", "cover", "sleeve", "bag", "pouch",
      "strap", "cable", "charger", "adapter", "plug", "cord", "stand", "mount",
      "holder", "pad", "mat", "protector", "glass", "skin", "wrap", "spare",
      "cartridge", "capsule", "pod", "ink", "toner", "bulb", "lamp", "tube",
    ]);

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
      const baseScore = hits / productTokens.length;
      // Heavy penalty for accessory/replacement results — not the main product
      const isAccessory = [...titleWords].some(w => ACCESSORY_WORDS.has(w));
      return { r, score: isAccessory ? baseScore * 0.15 : baseScore };
    }).sort((a: { r: unknown; score: number }, b: { r: unknown; score: number }) => b.score - a.score);

    const match = scored[0]?.r ?? null;
    if (!match) return null;

    console.log(`[price] Rainforest best match: "${String(match.title).slice(0, 50)}" score=${scored[0].score.toFixed(2)} price=₹${match.price?.value}`);

    const priceVal = (match.price as Record<string, unknown>)?.value;
    // Math.round removes decimals — prices like ₹4,949.10 become ₹4,949
    const priceStr = priceVal ? `₹${Math.round(Number(priceVal)).toLocaleString("en-IN")}` : null;
    if (!priceStr) return null;

    // Build direct product URL using ASIN — goes straight to product page, no search
    const asin = match.asin ?? (match.price as Record<string, unknown>)?.asin;
    const directLink = asin
      ? `https://www.amazon.in/dp/${asin}`
      : `https://www.amazon.in/s?k=${encodeURIComponent(product)}`;

    return {
      price: priceStr,
      title: String(match.title ?? product),
      directLink,
      inStock: match.availability?.type !== "out_of_stock",
    };
  } catch (err) {
    console.warn("[price] Rainforest fetch failed:", String(err).slice(0, 100));
    return null;
  }
}

type ProgressFn = (stage: string, message: string) => void;

/**
 * Core price-lookup logic, decoupled from HTTP transport.
 * Callable from both the JSON POST path and the SSE streaming path.
 */
async function runPriceLookup(
  product: string,
  userProfile: { savedCards?: string[]; upiPreferences?: string[] },
  onProgress?: ProgressFn,
): Promise<{ result: Record<string, unknown>; cacheHit: boolean; ageMs?: number }> {
  const startTime = Date.now();
  const sessionId = `price_${Date.now()}`;

  // ── Cache check — save 30-65s on repeat queries within TTL ──
  const cacheKey = priceCache.makeKey(product, userProfile as Record<string, unknown>);
  const cached = priceCache.get<Record<string, unknown>>(cacheKey);
  if (cached) {
    const ageMin = Math.round(cached.ageMs / 60_000);
    console.log(`[price] Cache HIT for "${product.slice(0, 40)}" (key ${cacheKey}, age ${ageMin}m)`);
    onProgress?.("cache-hit", `Loaded from cache — ${ageMin}m old, instant response.`);
    logStep({
      sessionId, agentName: "price_optimizer", step: "cache_hit",
      input: product, output: `age=${ageMin}m`, status: "complete",
      durationMs: Date.now() - startTime,
    });
    return {
      result: { ...cached.data, _cached: true, _cacheAgeMs: cached.ageMs },
      cacheHit: true,
      ageMs: cached.ageMs,
    };
  }

  const cards = userProfile.savedCards?.join(", ") || "none";
  const upi = userProfile.upiPreferences?.join(", ") || "none";

    logStep({ sessionId, agentName: "price_optimizer", step: "search_start", input: product, status: "running" });
    onProgress?.("scanning", "Scanning 11 Indian platforms — takes 30-60s on a fresh query…");

    // ── Run Rainforest + Phase 1 in parallel ──
    const [amazonData, searchResult] = await Promise.allSettled([
      fetchAmazonPrice(product),
      withTimeout(
        genAI.getGenerativeModel({
          model: MODEL,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [{ googleSearch: {} } as any],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.1 },
        }).generateContent(`Find the CURRENT SELLING PRICE of "${product}" across ALL major Indian shopping platforms right now.

Search each of these platforms specifically:

E-COMMERCE:
- site:flipkart.com "${product}"
- site:meesho.com "${product}"
- site:jiomart.com "${product}"

ELECTRONICS RETAIL:
- site:croma.com "${product}"
- site:reliancedigital.in "${product}"
- site:tatacliq.com "${product}"
- site:vijaysales.com "${product}"

QUICK COMMERCE (same-day delivery in major Indian cities):
- site:blinkit.com "${product}"
- site:zepto.com "${product}"
- site:swiggy.com instamart "${product}"

Also check the brand's official India website if applicable.

CRITICAL: Report the CURRENT SELLING PRICE (what a buyer pays today), NOT the MRP/strikethrough price.

For each platform where the product is found, report:
1. Current selling price in rupees
2. The FULL direct product page URL — REQUIRED. Format rules are STRICT:
   - Flipkart: https://www.flipkart.com/[slug]/p/[itemId]
   - Amazon India: https://www.amazon.in/dp/[ASIN]  (ASIN = 10 uppercase chars)
   - Croma: https://www.croma.com/[slug]/p/[numericId]
   - Meesho: https://www.meesho.com/[slug]/p/[numericId]
   - Blinkit: https://www.blinkit.com/prn/[slug]/prid/[id]
   - Zepto: https://www.zepto.com/pn/[slug]/pvid/[id]
   Output plain URLs ONLY — no Markdown brackets, no backticks, no quotes, no URL-encoding.
   If you cannot find a direct product URL for a platform, OMIT that platform entry entirely rather than substituting a search URL or guessing.
3. In stock status
4. For quick commerce (Blinkit/Zepto/Instamart): note it's same-day delivery, city-specific
5. Any bank card discount for: ${cards}
6. Any UPI cashback for: ${upi}
7. Delivery time
8. Return policy
9. Any bundle / multi-pack / combo offers on this platform (e.g. "Buy 2 Get 1 Free", "Pack of 3 for ₹X", "Combo deal"). Only include if the bundle is currently available and priced (not just MRP). Report: bundle description, total price, unit price, and savings % vs buying units separately.

Also report:
- ALL-TIME LOW (ATL) — the lowest price this product has hit across major Indian platforms, based on what you can find from web search (price tracker sites, deal forums, old sale screenshots, review articles referencing past prices). Report it as: lowest price in ₹, which platform it was on, approximate date (e.g. "Jun 2023" or "during Big Billion Days 2023"), and whether you directly cited a source or inferred it. If you cannot find any credible ATL reference, say so explicitly — do NOT fabricate a number.
- Any Indian sale events in the next 30 days.
Only report data you actually find. Do not guess or estimate prices.`),
        75000,
        "Phase 1 search"
      ),
    ]);

    const amazonResult = amazonData.status === "fulfilled" ? amazonData.value : null;
    const rawPriceData = searchResult.status === "fulfilled"
      ? stripMarkdown(searchResult.value.response.text()).slice(0, 8000)
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
    onProgress?.("structuring", "Ranking prices by effective cost after discounts…");

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
      "returnPolicy": "string",
      "bundles": [
        {
          "description": "Pack of 3 — save on bulk",
          "totalPrice": "₹1,299",
          "unitPrice": "₹433",
          "savingsPct": 33,
          "url": "optional direct URL to the bundle listing"
        }
      ]
    }
  ],
  "verdict": {
    "action": "buy_now",
    "bestPlatform": "string",
    "bestEffectivePrice": "₹X,XXX",
    "savings": "string — ₹X,XXX",
    "savingsBasis": "card_discount | vs_listed_alternative | vs_mrp | none",
    "reason": "string",
    "waitUntil": null,
    "expectedWaitPrice": null
  },
  "priceContext": "string",
  "atl": {
    "price": "₹X,XXX",
    "source": "platform name (e.g. Flipkart, Amazon India)",
    "asOf": "short date string (e.g. May 2023, Big Billion Days 2023)",
    "confidence": "high" | "medium" | "low"
  },
  "upcomingSales": ["string"]
}

Rules:
- The "name" field MUST be EXACTLY one of: ${KNOWN_PLATFORMS.join(", ")}. Do NOT invent platform names. Do NOT include brand websites, toy-store names, or retailers not in this list. If a price only exists on an unlisted site, mention it in priceContext — never as a platforms[] entry.
- listedPrice = the CURRENT SELLING PRICE (what buyer pays). NEVER use MRP. Prefer lower price if two are shown.
- If "ACCURATE AMAZON INDIA DATA" is provided above, use EXACTLY that price for Amazon India. Do not change it.
- inStock = true if platform shows a live price. Set false ONLY if explicitly marked out of stock.
- Include only platforms with actual prices found. Sort by effectivePrice ascending.
- effectivePrice = listedPrice minus applicable ${cards} card discount and ${upi} cashback.
- effectivePrice must never be less than 80% of listedPrice.
- verdict.savings calculation (use the FIRST applicable basis, set savingsBasis accordingly):
   1. card_discount — if a card / UPI / coupon discount applies, savings = listedPrice − effectivePrice on the chosen platform.
   2. vs_listed_alternative — if no discount applies but multiple platforms report different listedPrices, savings = highest listedPrice across platforms − chosen effectivePrice.
   3. vs_mrp — if only one platform stocks the product but Phase 1 mentions a credible MRP higher than listedPrice, savings = MRP − listedPrice. Only use a stated MRP, never invent one.
   4. none — set savings to "₹0" and savingsBasis to "none" only when nothing above applies. Don't fabricate.
- verdict.action = "wait" only if a confirmed sale within 15 days will drop price >10%, otherwise "buy_now".
- verdict.bestPlatform MUST be one of the whitelisted names. If no whitelisted platform has the product, return platforms: [] and set verdict.bestPlatform to "" (empty string).
- atl (all-time low): populate ONLY if the Phase 1 search surfaced a credible historical low price with a source and rough date. Otherwise set atl to null — do NOT fabricate a number.
- atl.confidence: "high" when directly cited from a price-tracker or sale-coverage article; "medium" when mentioned in forum/review prose; "low" when inferred or approximate.
- atl.price format: "₹X,XXX" (same as other prices).
- bundles: Include the "bundles" array on a platform ONLY when Phase 1 explicitly reports bundle / multi-pack / combo pricing for that platform. If no bundles were reported, OMIT the field entirely — do NOT return an empty array. Never fabricate bundles.
- bundles[].description: short human phrase like "Pack of 3 — save on bulk" or "Buy 2 Get 1 Free".
- bundles[].totalPrice and bundles[].unitPrice: "₹X,XXX" format. unitPrice = totalPrice / units.
- bundles[].savingsPct: integer 1-90. Rough % saved vs buying the same number of units at single-unit price.
- bundles[].url: include only if Phase 1 gave a direct URL for the bundle; otherwise omit this field.
- atl.source: must be a recognisable Indian platform name (Flipkart, Amazon India, Croma, etc.) — not a price-tracker domain.`;

    // ── Phase 2 with retry-once on transient failure ──
    // Gemini occasionally returns empty / truncated JSON, especially for verbose
    // products. One retry catches most of these so users don't see "Price check failed".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any;
    let jsonText = "";
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const structureResult = await withTimeout(
          structureModel.generateContent(structurePrompt),
          30000,
          `Phase 2 structure (attempt ${attempt})`
        );
        jsonText = structureResult.response.text();
        console.log(`[price] Phase 2 attempt ${attempt} JSON preview:`, jsonText.slice(0, 150));
        if (!jsonText || jsonText.trim().length < 10) {
          throw new Error("Phase 2 returned empty response");
        }
        parsed = sanitize(repairAndParseJson(jsonText));
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Phase 2 parsed to non-object");
        }
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        console.warn(`[price] Phase 2 attempt ${attempt} failed:`, String(e).slice(0, 200));
        if (attempt === 1) {
          // brief backoff before retry
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
    if (lastErr) throw lastErr;

    // ── Whitelist filter — drop any hallucinated platform names before they reach the UI ──
    // Gemini has been caught inventing retailers (e.g. "Imaginext" for a camera).
    // Only accept the 11 canonical Indian platforms; normalize name variants.
    type PlatformRow = { name?: string; effectivePrice?: string; [k: string]: unknown };
    const rawPlatforms = (parsed?.platforms as PlatformRow[] | undefined) ?? [];
    const filtered = filterPlatforms(rawPlatforms);
    parsed.platforms = filtered;

    // If the verdict points at a dropped platform, fall back to the cheapest survivor.
    type Verdict = {
      bestPlatform?: string;
      bestEffectivePrice?: string;
      savings?: string;
      savingsBasis?: string;
      [k: string]: unknown;
    };
    const verdict = parsed?.verdict as Verdict | undefined;
    if (verdict && verdict.bestPlatform && !canonicalPlatform(verdict.bestPlatform)) {
      if (filtered.length > 0) {
        verdict.bestPlatform = filtered[0].name;
        verdict.bestEffectivePrice = filtered[0].effectivePrice ?? verdict.bestEffectivePrice;
        verdict.reason = `Best available price across tracked platforms.`;
      } else {
        verdict.bestPlatform = "";
        verdict.bestEffectivePrice = "";
        verdict.reason = "This product isn't currently listed on any platform Loot tracks.";
      }
    }

    // ── Defensive savings fallback ──
    // If Gemini returned ₹0 savings but we have multiple platforms with different
    // listedPrices, compute "vs highest listed alternative" so the user sees a real
    // comparison-based saving. Belt-and-braces against Option A in the prompt.
    type RowWithPrices = { name?: string; listedPrice?: string; effectivePrice?: string };
    const numFromPx = (s: unknown): number => {
      if (typeof s !== "string") return NaN;
      const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(n) ? n : NaN;
    };
    if (verdict && filtered.length >= 2) {
      const currentSavings = numFromPx(verdict.savings);
      if (!Number.isFinite(currentSavings) || currentSavings <= 0) {
        const rows = filtered as RowWithPrices[];
        const chosenPx = numFromPx(verdict.bestEffectivePrice);
        const highestListed = rows
          .map((r) => numFromPx(r.listedPrice))
          .filter((n): n is number => Number.isFinite(n))
          .reduce((m, n) => Math.max(m, n), 0);
        if (Number.isFinite(chosenPx) && highestListed > 0 && highestListed > chosenPx) {
          const diff = highestListed - chosenPx;
          verdict.savings = `₹${diff.toLocaleString("en-IN")}`;
          verdict.savingsBasis = "vs_listed_alternative";
        }
      }
    }

    // ── ATL sanity check ──
    // Gemini occasionally returns an ATL that's HIGHER than the current price.
    // That makes no sense for an "all-time low" claim — drop it rather than display
    // a confusing badge. Only keep ATL when it's <= current effective price.
    type AtlInfo = { price?: string; [k: string]: unknown };
    const atl = parsed?.atl as AtlInfo | null | undefined;
    if (atl && verdict?.bestEffectivePrice) {
      const atlPx = numFromPx(atl.price);
      const chosenPx = numFromPx(verdict.bestEffectivePrice);
      if (Number.isFinite(atlPx) && Number.isFinite(chosenPx) && atlPx > chosenPx) {
        console.log(`[price] dropping nonsense ATL (₹${atlPx} > current ₹${chosenPx})`);
        parsed.atl = null;
      }
    }

    // ── Similar-model softening ──
    // When Gemini's reason explicitly says it found a SIMILAR model (not the exact
    // requested config), don't celebrate with a green "Buy now" verdict — soften
    // the action so the user knows this is a close-match suggestion, not the real deal.
    type ReasonHints = { reason?: string; action?: string; [k: string]: unknown };
    const v = verdict as ReasonHints | undefined;
    if (v && typeof v.reason === "string") {
      const r = v.reason.toLowerCase();
      const isSimilarMatch =
        r.includes("similar model") ||
        r.includes("similar product") ||
        r.includes("exact configuration is not") ||
        r.includes("exact config not") ||
        r.includes("exact spec not") ||
        r.includes("close match") ||
        r.includes("variant of");
      if (isSimilarMatch && v.action === "buy_now") {
        v.action = "similar_match";
      }
    }

    onProgress?.("linking", "Linking each price to its direct product page…");

    // ── Extract direct platform URLs from Phase 1 prose ──
    // Shared preprocessing (Markdown unwrap, URL-decode, backtick strip) +
    // per-platform regex lives in @/lib/platform-urls; see tests/platform_url_extraction.test.ts.
    const directLinks = extractDirectLinks(rawPriceData, amazonResult?.directLink);

    console.log("[price] Direct links found:", Object.keys(directLinks).join(", ") || "none");

    // Observability: warn when a platform is reported with a price but we
    // couldn't extract its URL. Previously failed silently and shipped a
    // search-URL fallback that landed on the wrong product.
    type PlatformOut = { name?: string; inStock?: boolean };
    for (const p of (parsed.platforms ?? []) as PlatformOut[]) {
      if (p?.inStock && typeof p.name === "string" && !directLinks[p.name]) {
        console.warn(`[price] ${p.name}: price found but no direct URL extracted — falling back to search`);
      }
    }

    logStep({
      sessionId, agentName: "price_optimizer", step: "complete",
      output: jsonText.slice(0, 200), status: "complete",
      durationMs: Date.now() - startTime,
    });

    const finalResult = { ...parsed, directLinks };

    // Write-through cache — future requests for the same product + profile within TTL get it for free.
    priceCache.set(cacheKey, finalResult);

    return { result: finalResult, cacheHit: false };
}

/**
 * HTTP dispatcher. Picks JSON or SSE transport based on the Accept header.
 * - text/event-stream → streaming progress + result event (frontend UX)
 * - anything else     → buffered JSON (tests, curl, API clients)
 */
export async function POST(req: Request) {
  let product = "";
  let userProfile: { savedCards?: string[]; upiPreferences?: string[] } = {};

  try {
    const body = await req.json() as {
      product: string;
      userProfile: { savedCards?: string[]; upiPreferences?: string[] };
    };
    product = body.product;
    userProfile = body.userProfile ?? {};
  } catch (err) {
    console.error("[price] Bad request body:", String(err).slice(0, 150));
    return Response.json({ error: "Price check failed. Please try again." }, { status: 400 });
  }

  if (typeof product !== "string" || !product.trim()) {
    return Response.json({ error: "Missing product" }, { status: 400 });
  }

  const wantsStream = req.headers.get("accept")?.includes("text/event-stream");

  if (!wantsStream) {
    // Legacy JSON path — backward-compat for test:prices and any API clients.
    try {
      const { result } = await runPriceLookup(product, userProfile);
      return Response.json(result);
    } catch (err) {
      console.error("[price] Error:", String(err).slice(0, 300));
      return Response.json({ error: "Price check failed. Please try again." }, { status: 500 });
    }
  }

  // ── SSE streaming path ──
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true; // client disconnected
        }
      };

      try {
        const { result, cacheHit } = await runPriceLookup(product, userProfile, (stage, message) => {
          send("progress", { stage, message });
        });
        send("result", { ...result, _cached: cacheHit });
      } catch (err) {
        console.error("[price] SSE Error:", String(err).slice(0, 300));
        send("error", { message: "Price check failed. Please try again." });
      } finally {
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // keep chunks flowing through intermediate proxies
    },
  });
}
