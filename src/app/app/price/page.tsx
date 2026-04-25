"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { saveToWishlist } from "@/app/app/wishlist/page";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

// Bundle / multi-pack / combo offer on a platform.
// Optional — only present when the platform has an active combo deal.
interface Bundle {
  description: string;        // "Pack of 3 — save on bulk"
  totalPrice: string;         // "₹1,299"
  unitPrice: string;          // "₹433"
  savingsPct: number;         // 33
  url?: string;               // direct URL to the bundle if available
}

interface Platform {
  name: string;
  listedPrice: string;
  effectivePrice: string;
  savings: string;
  discountApplied: string;
  couponCode: string | null;
  inStock: boolean;
  deliveryEta: string;
  sellerTrust: string;
  returnPolicy: string;
  bundles?: Bundle[];         // optional — combo/multi-pack offers
}

// ATL (all-time low) — structured object from Gemini. null when no credible data.
// Kept as a union with string for backward-compat with older cached responses that
// still carry the plain-string shape. Normalised by toAtl() before rendering.
interface AtlInfo {
  price: string;
  source: string;
  asOf: string;
  confidence: "high" | "medium" | "low";
}

interface PriceResult {
  product: string;
  searchedAt: string;
  platforms: Platform[];
  verdict: {
    action: "buy_now" | "wait" | "similar_match";
    bestPlatform: string;
    bestEffectivePrice: string;
    savings: string;
    reason: string;
    waitUntil: string | null;
    expectedWaitPrice: string | null;
  };
  priceContext: string;
  atl: AtlInfo | string | null;
  upcomingSales: string[];
  directLinks?: Record<string, string>; // platform name → direct product page URL
}

// Normalise the ATL field into a structured object or null.
// - null / empty / "not found" strings → null (no badge rendered)
// - already-structured object → passed through with defensive defaults
// - legacy string ("₹12,999 on Flipkart, May 2023") → best-effort parse;
//   if we can't extract a price, fall back to low-confidence prose display.
function toAtl(raw: AtlInfo | string | null | undefined): AtlInfo | null {
  if (!raw) return null;
  if (typeof raw === "object") {
    const price = typeof raw.price === "string" ? raw.price.trim() : "";
    if (!price || price === "—") return null;
    return {
      price,
      source: typeof raw.source === "string" ? raw.source.trim() : "",
      asOf: typeof raw.asOf === "string" ? raw.asOf.trim() : "",
      confidence: raw.confidence === "high" || raw.confidence === "medium" ? raw.confidence : "low",
    };
  }
  const s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("not ") || lower === "n/a" || lower === "none" || lower === "unknown") return null;
  // Legacy string shape: try to pull out the first ₹-amount and the rest as prose.
  const priceMatch = s.match(/₹\s?[\d,]+/);
  if (!priceMatch) return null;
  const price = priceMatch[0].replace(/\s/g, "");
  const rest = s.replace(priceMatch[0], "").replace(/^[\s,·•-]+/, "").trim();
  return { price, source: rest, asOf: "", confidence: "low" };
}

// Helper: Google site-search URL — bulletproof fallback for any platform whose own
// search route is flaky (Vijay Sales' /search/{q} 404s; Croma's /searchB returns
// empty pages on long queries). Lands on Google with relevant results, never 404s.
const googleSite = (domain: string) => (q: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${q}`)}`;

// Fallback search URLs when Gemini can't find the direct product page.
// Reliable native search → use it. Unreliable / often E002s on direct URL → Google site-search.
const PLATFORM_SEARCH: Record<string, (q: string) => string> = {
  // E-commerce — Amazon's search is reliable; Flipkart's product URLs Gemini extracts
  // sometimes resolve to E002 errors so we route Flipkart through Google site-search too.
  "Amazon India": (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  "Flipkart": googleSite("flipkart.com"),
  "Meesho": (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
  "JioMart": (q) => `https://www.jiomart.com/search#q=${encodeURIComponent(q)}`,
  // Electronics retail — native search is unreliable, use Google site-search
  "Croma": googleSite("croma.com"),
  "Reliance Digital": googleSite("reliancedigital.in"),
  "Tata Cliq": googleSite("tatacliq.com"),
  "Vijay Sales": googleSite("vijaysales.com"),
  // Quick commerce — native search works
  "Blinkit": (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
  "Zepto": (q) => `https://www.zepto.com/search?query=${encodeURIComponent(q)}`,
  "Swiggy Instamart": (q) => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}`,
};

// Trailing generic descriptors Gemini sometimes pads into product names.
// Stripping them improves platform search hit-rate (e.g. Croma returning "no results"
// because the query was "Sony WH 1000XM6 Headphones Microphones Studio Quality").
const GENERIC_TAIL_WORDS = new Set([
  "headphones", "earphones", "earbuds", "speaker", "speakers",
  "microphone", "microphones", "mic", "mics",
  "studio", "quality", "premium", "professional", "pro",
  "with", "and", "for", "the",
]);

function cleanSearchQuery(s: string): string {
  const cleaned = s.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  // Cap at 6 words to keep platform search tight.
  const words = cleaned.split(" ").slice(0, 6);
  // Drop trailing generic descriptor words (but keep at least 2 to preserve brand+model).
  while (words.length > 2 && GENERIC_TAIL_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words.join(" ");
}

function getPlatformUrl(
  platform: Platform,
  productName: string | null | undefined,
  directLinks?: Record<string, string>
): string {
  // Priority 1: direct product page URL (from Rainforest ASIN or Phase 1 URL extraction)
  // e.g. amazon.in/dp/B0BZP2H373 or flipkart.com/[slug]/p/itmb7d860129eb21
  // Goes straight to the product — no search, no sponsored noise.
  if (directLinks) {
    const match = Object.keys(directLinks).find(k =>
      platform.name.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(platform.name.toLowerCase())
    );
    if (match) {
      const url = directLinks[match];
      // Flipkart product URLs from Phase 1 sometimes resolve to E002 errors.
      // Only trust the direct URL if it matches the strict /p/itm{id} pattern;
      // otherwise drop through to the Google site-search fallback below.
      if (platform.name.toLowerCase().includes("flipkart")) {
        const strict = /^https?:\/\/(?:www\.)?flipkart\.com\/[^?#]*\/p\/itm[a-z0-9]{10,}/i;
        if (!strict.test(url)) {
          // fall through to PLATFORM_SEARCH (Google site-search for Flipkart)
        } else {
          return url;
        }
      } else {
        return url;
      }
    }
  }

  // Priority 2: platform search using a cleaned, capped query so verbose AI-generated
  // names don't return zero results on the destination site.
  const baseQuery = (typeof productName === "string" && productName.trim())
    ? productName
    : platform.name;
  const query = cleanSearchQuery(baseQuery);

  const searchFn = Object.entries(PLATFORM_SEARCH).find(([key]) =>
    platform.name.toLowerCase().includes(key.toLowerCase())
  )?.[1];
  return searchFn ? searchFn(query) : `https://www.google.com/search?q=${encodeURIComponent(platform.name + " " + query)}`;
}

function getProfile() {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("loot_profile") ?? "{}"); }
  catch { return {}; }
}

// Safe price string — returns "—" instead of null/undefined/object; strips trailing commas
function px(s: unknown): string {
  if (typeof s === "string" && s.trim()) return s.trim().replace(/,\s*$/, "");
  return "—";
}

// Returns true only if a field value is actually useful to show.
// Filters out Gemini's "Not found", "Not specified", "N/A" etc.
function isUseful(v: unknown): v is string {
  if (!v || typeof v !== "string") return false;
  const l = v.toLowerCase().trim();
  return l.length > 1 &&
    !l.startsWith("not found") &&
    !l.startsWith("not specified") &&
    !l.startsWith("not explicitly") &&
    !l.includes("n/a") &&
    l !== "none" &&
    l !== "high"; // standalone "High" sellerTrust adds no info
}

// Parse ₹ price string to integer for sorting; unparseable = Infinity (goes last)
// Convert "₹12,024.07" → 12024 (rounded to whole rupees).
// Earlier version stripped the decimal point along with everything else, so
// "₹974.93" became 97493 — that polluted the savings dashboard.
function parsePx(s: unknown): number {
  if (typeof s !== "string") return Infinity;
  // Keep digits and decimals; drop ₹, commas, spaces, etc.
  const cleaned = s.replace(/[^0-9.]/g, "");
  // Defensive: if multiple dots somehow appear, keep only the last as the decimal.
  const lastDot = cleaned.lastIndexOf(".");
  const normalized =
    lastDot >= 0
      ? cleaned.slice(0, lastDot).replace(/\./g, "") + "." + cleaned.slice(lastDot + 1)
      : cleaned;
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? Math.round(n) : Infinity;
}

// Small ATL badge rendered below prices. Gemini-approximated, not a real time series.
// Low-confidence reads get a muted style + "approx" label so users can gauge trust.
function AtlBadge({ atl, compact = false }: { atl: AtlInfo; compact?: boolean }) {
  const isLow = atl.confidence === "low";
  const label = isLow ? "ATL (approx)" : "ATL";
  const meta = [atl.source, atl.asOf].filter((x) => x && x.length > 0).join(" · ");
  const title = isLow
    ? "All-time low — Gemini's best guess from web search. Confidence: low, so treat it as a rough reference."
    : "All-time low — lowest price Gemini found for this product across major Indian platforms.";
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[11px] ${
        isLow ? "text-zinc-500" : "text-amber-400/90"
      } ${compact ? "" : "leading-tight"}`}
    >
      <span className="font-semibold uppercase tracking-wide text-[10px]">{label}:</span>
      <span className="font-medium">{atl.price}</span>
      {meta && <span className="text-zinc-600">· {meta}</span>}
    </span>
  );
}

const LOADING_MESSAGES = [
  "Scanning Amazon India...",
  "Checking Flipkart prices...",
  "Searching Croma & Reliance Digital...",
  "Applying your bank card discounts...",
  "Checking for active coupon codes...",
  "Analysing price history...",
  "Computing your best deal...",
];

// Auto-log a deal when user clicks "Buy on Platform"
// savings = actual discount from listed price (e.g. ₹7,249 off with HDFC card)
// NOT vs highest alternative — that gave ₹0 when only one platform existed
async function logDeal(
  productName: string,
  platform: string,
  bestPrice: number,
  savings: number        // renamed from marketHighPrice — this is the actual saving
) {
  try {
    const profile = getProfile();
    const safeSavings = Math.max(0, Number.isFinite(savings) ? savings : 0);
    // Keep ₹0 deals — the user saved time even if no money. Display side renders
    // them as "Tracked" instead of "₹0 found" so they don't read as a flat outcome.
    const DEALS_KEY = "loot_pending_deals";
    const existing: unknown[] = JSON.parse(localStorage.getItem(DEALS_KEY) ?? "[]");
    const deal = {
      id: `deal_${Date.now()}`,
      productName,
      platform,
      bestPrice,
      marketHighPrice: bestPrice + safeSavings,
      savedVsHighest: safeSavings,
      confirmedPurchase: false,
      createdAt: Date.now(),
    };
    localStorage.setItem(DEALS_KEY, JSON.stringify([deal, ...existing].slice(0, 50)));

    // Persist to Convex in background
    fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName,
        platform,
        bestPrice,
        marketHighPrice: deal.marketHighPrice,
        userEmail: profile.email || undefined,
        sessionId: deal.id,
      }),
    }).catch(() => {/* non-fatal */});
  } catch { /* non-fatal */ }
}

function PricePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const product = searchParams.get("product") ?? "";

  const [result, setResult] = useState<PriceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [wishlisted, setWishlisted] = useState(false);

  // FIX 1: guard against React 18 StrictMode double-invocation
  // AbortController cancels the in-flight request if the effect re-runs or component unmounts
  const abortRef = useRef<AbortController | null>(null);

  // Consumes SSE events from /api/price. Falls back to JSON parse if the server
  // ever returns non-streaming (shouldn't happen with current backend, but defensive).
  const fetchPrices = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    setResult(null);
    setProgressMsg("Warming up…");
    track("price_run", { product: product.slice(0, 200) });

    try {
      const res = await fetch("/api/price", {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({ product, userProfile: getProfile() }),
      });

      if (signal.aborted) return;

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok && !contentType.includes("text/event-stream")) {
        const data = await res.json().catch(() => ({ error: "Price check failed" }));
        throw new Error(data.error ?? "Price check failed");
      }

      if (!res.body || !contentType.includes("text/event-stream")) {
        // Server returned JSON (older deploy or fallback) — handle it.
        const data = await res.json();
        if (signal.aborted) return;
        if (!res.ok) throw new Error(data.error ?? "Price check failed");
        setResult(data);
        return;
      }

      // Stream SSE frames. Frames are separated by a blank line; each frame has
      // "event: <name>\ndata: <json>\n".
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (signal.aborted) {
          reader.cancel().catch(() => {});
          return;
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.trim()) continue;
          let eventName = "message";
          let dataLine = "";
          for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          let parsed: unknown;
          try { parsed = JSON.parse(dataLine); } catch { continue; }

          if (eventName === "progress") {
            const p = parsed as { stage?: string; message?: string };
            if (p.message) setProgressMsg(p.message);
          } else if (eventName === "result") {
            setResult(parsed as PriceResult);
          } else if (eventName === "error") {
            const p = parsed as { message?: string };
            throw new Error(p.message ?? "Price check failed");
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // intentional cancel
      setError((e as Error).message ?? "Couldn't pull live prices. Try again in a moment.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;

    // Cancel any previous in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchPrices is async; state updates happen after awaits, not synchronously in this effect body
    fetchPrices(controller.signal);

    return () => controller.abort(); // cleanup on unmount or product change
  }, [product, fetchPrices]);

  // Loading copy is now server-driven via SSE `progress` events. No interval needed.

  if (!product) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-500 mb-4">No product selected.</p>
        <button onClick={() => router.push("/app/research")} className="text-amber-400 hover:underline text-sm">
          ← Back to research
        </button>
      </div>
    );
  }

  // FIX 3: safe sort — unparseable prices go last, no NaN comparisons
  const sortedPlatforms = result
    ? [...result.platforms].sort((a, b) => parsePx(a.effectivePrice) - parsePx(b.effectivePrice))
    : [];

  // Normalise ATL once per render so verdict card + intelligence panel share the same shape.
  const atl = result ? toAtl(result.atl) : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <button onClick={() => router.push("/app/research")} className="text-zinc-600 hover:text-zinc-400 text-sm mb-4 block transition-colors">
          ← Back to research
        </button>
        <h1 className="text-2xl font-black text-white leading-tight">{product}</h1>
        <p className="text-zinc-500 text-sm mt-1">Price comparison across Indian platforms</p>
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center">
            <div className="flex justify-center gap-1 mb-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-zinc-400 text-sm">{progressMsg || LOADING_MESSAGES[0]}</p>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 bg-zinc-800 rounded w-32" />
                  <div className="h-4 bg-zinc-800 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-400/10 border border-red-400/20 rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={() => {
              abortRef.current?.abort();
              const c = new AbortController();
              abortRef.current = c;
              fetchPrices(c.signal);
            }}
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-5 py-2 text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {result && !loading && (() => {
        const notTracked =
          result.platforms.length === 0 ||
          !result.verdict.bestPlatform ||
          px(result.verdict.bestPlatform) === "—";
        return (
        <div className="space-y-6">
          {/* Verdict */}
          {notTracked ? (
            <div className="rounded-2xl p-6 border bg-zinc-900/40 border-zinc-700/40">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-2 text-zinc-400">
                    Not tracked
                  </div>
                  <div className="text-white font-black text-xl mb-2">
                    Loot couldn&apos;t find this on any tracked platform.
                  </div>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-4">
                    {result.verdict.reason || "This product isn’t currently listed on any platform Loot tracks. Try a close alternative, or check back later — listings change often."}
                  </p>
                  <a
                    href="/app/research"
                    className="inline-flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-200 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                  >
                    ← Try another search
                  </a>
                </div>
                <div className="text-4xl shrink-0">🔍</div>
              </div>
            </div>
          ) : (
          <div className={`rounded-2xl p-6 border ${
            result.verdict.action === "buy_now"
              ? "bg-green-400/5 border-green-400/25"
              : result.verdict.action === "similar_match"
                ? "bg-zinc-900/40 border-zinc-700/40"
                : "bg-amber-400/5 border-amber-400/25"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
                  result.verdict.action === "buy_now"
                    ? "text-green-400"
                    : result.verdict.action === "similar_match"
                      ? "text-zinc-300"
                      : "text-amber-400"
                }`}>
                  {result.verdict.action === "buy_now"
                    ? "✓ Buy now"
                    : result.verdict.action === "similar_match"
                      ? "≈ Similar match"
                      : "⏳ Wait"}
                </div>
                <div className="text-white font-black text-2xl mb-1">
                  {px(result.verdict.bestEffectivePrice)}
                  <span className="text-zinc-500 font-normal text-base ml-2">on {px(result.verdict.bestPlatform)}</span>
                </div>
                {atl && (
                  <div className="mb-2">
                    <AtlBadge atl={atl} />
                  </div>
                )}
                {result.verdict.savings && px(result.verdict.savings) !== "—" && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-sm font-bold ${
                      result.verdict.action === "buy_now" ? "text-green-400" : "text-amber-400"
                    }`}>
                      {px(result.verdict.savings)}
                    </span>
                    <span className="text-zinc-600 text-xs">vs listed price</span>
                  </div>
                )}
                <p className="text-zinc-400 text-sm leading-relaxed mb-4">{result.verdict.reason}</p>
                {result.verdict.action === "wait" && result.verdict.waitUntil && (
                  <p className="text-amber-400/70 text-xs mb-4">
                    Wait until: {result.verdict.waitUntil}
                    {result.verdict.expectedWaitPrice && ` — expected ${result.verdict.expectedWaitPrice}`}
                  </p>
                )}
                {(result.verdict.action === "buy_now" || result.verdict.action === "similar_match") && (() => {
                  const bestPlatform = result.platforms.find(p =>
                    p.name.toLowerCase().includes((result.verdict.bestPlatform ?? "").toLowerCase())
                  );
                  const buyUrl = bestPlatform
                    ? getPlatformUrl(bestPlatform, product, result.directLinks)
                    : getPlatformUrl({ name: result.verdict.bestPlatform ?? "" } as Platform, product, result.directLinks);
                  // Use actual savings from verdict (e.g. ₹7,249 from HDFC discount)
                  // NOT vs-highest-alternative which gives ₹0 when only one platform exists
                  const actualSavings = parsePx(result.verdict.savings);
                  return (
                    <div className="flex items-center gap-3 flex-wrap">
                      {buyUrl && (
                        <a
                          href={buyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            track("buy_click", {
                              product: product.slice(0, 200),
                              platform: result.verdict.bestPlatform ?? "",
                              bestPrice: parsePx(result.verdict.bestEffectivePrice),
                              savings: actualSavings,
                              source: "verdict_card",
                            });
                            logDeal(
                              product,
                              result.verdict.bestPlatform ?? "",
                              parsePx(result.verdict.bestEffectivePrice),
                              actualSavings
                            );
                          }}
                          className="inline-flex items-center gap-2 bg-green-400 hover:bg-green-300 text-black font-black rounded-xl px-6 py-3 text-sm transition-colors"
                        >
                          Buy on {result.verdict.bestPlatform} →
                        </a>
                      )}
                      {/* Save button lives next to Buy — easier to find */}
                      <button
                        onClick={() => {
                          const r = saveToWishlist({
                            productName: product,
                            platform: result.verdict.bestPlatform,
                            bestPrice: parsePx(result.verdict.bestEffectivePrice),
                          });
                          if (r.status === "added") {
                            setWishlisted(true);
                            toast.success("Saved to wishlist.");
                          } else if (r.status === "already") {
                            setWishlisted(true);
                            toast("Already in your wishlist.");
                          } else {
                            toast.error("Wishlist is full (50 max). Remove an item first.");
                          }
                        }}
                        title={wishlisted ? "Saved to wishlist" : "Save to wishlist"}
                        className={`border rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                          wishlisted
                            ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                            : "border-zinc-700 hover:border-zinc-500 text-zinc-400"
                        }`}
                      >
                        {wishlisted ? (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="inline mr-1"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>Saved</>
                      ) : (
                        <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline mr-1"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>Save</>
                      )}
                      </button>
                    </div>
                  );
                })()}
              </div>
              <div className="text-4xl shrink-0">
                {result.verdict.action === "buy_now" ? "🎯" : result.verdict.action === "similar_match" ? "🔍" : "⏳"}
              </div>
            </div>
          </div>
          )}

          {/* Price leaderboard */}
          <div>
            <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">
              Price comparison — sorted by effective price
            </div>
            <div className="space-y-3">
              {sortedPlatforms.map((p, i) => (
                <div
                  key={`${p.name}-${i}`}
                  className={`bg-zinc-950 rounded-2xl p-5 border transition-all ${
                    i === 0 && p.inStock ? "border-green-400/25" : "border-zinc-900"
                  } ${!p.inStock ? "opacity-50" : ""}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {i === 0 && p.inStock && (
                        <span className="text-[10px] bg-green-400/15 text-green-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Best deal
                        </span>
                      )}
                      <span className="text-white font-bold text-sm">{p.name}</span>
                      {!p.inStock && (
                        <span className="text-[10px] bg-amber-400/10 text-amber-500 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                          Check availability
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                      {/* FIX 3: px() ensures we never render null/undefined/object */}
                      <span className="text-white font-black text-xl">{px(p.effectivePrice)}</span>
                      {p.listedPrice !== p.effectivePrice && (
                        <span className="text-zinc-600 text-sm line-through">{px(p.listedPrice)}</span>
                      )}
                      {p.savings && p.savings !== "₹0" && p.savings !== "₹0,000" && (
                        <span className="text-green-400 text-xs font-semibold">{px(p.savings)} off</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-zinc-500 mb-3">
                      {isUseful(p.discountApplied) && p.discountApplied !== "none" && (
                        <span className="text-blue-400">{p.discountApplied}</span>
                      )}
                      {p.couponCode && typeof p.couponCode === "string" && (
                        <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded text-amber-400">
                          {p.couponCode}
                        </span>
                      )}
                      {isUseful(p.deliveryEta) && <span>📦 {p.deliveryEta}</span>}
                      {isUseful(p.returnPolicy) && <span>↩ {p.returnPolicy}</span>}
                      {isUseful(p.sellerTrust) && p.sellerTrust !== "High" && (
                        <span className="text-zinc-700">{p.sellerTrust}</span>
                      )}
                    </div>
                    {/* Bundles — multi-pack / combo offers on this platform.
                        Subtle one-liner; same visual weight as the savings note above. */}
                    {Array.isArray(p.bundles) && p.bundles.length > 0 && (
                      <div className="flex flex-col gap-1 mb-3">
                        {p.bundles.map((b, bi) => {
                          const pct = typeof b.savingsPct === "number" && b.savingsPct > 0
                            ? `, ${Math.round(b.savingsPct)}% off`
                            : "";
                          const unit = isUseful(b.unitPrice) ? `${px(b.unitPrice)}/unit` : "";
                          const meta = [unit, pct.replace(/^, /, "")].filter(Boolean).join(", ");
                          const desc = isUseful(b.description) ? b.description : "Bundle";
                          const total = isUseful(b.totalPrice) ? ` for ${px(b.totalPrice)}` : "";
                          const href = typeof b.url === "string" && b.url.startsWith("http")
                            ? b.url
                            : undefined;
                          const text = (
                            <span className="text-xs text-zinc-400">
                              🎁 <span className="text-zinc-300">{desc}{total}</span>
                              {meta && <span className="text-zinc-500"> ({meta})</span>}
                            </span>
                          );
                          return href ? (
                            <a
                              key={bi}
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-zinc-200 transition-colors"
                            >
                              {text}
                            </a>
                          ) : (
                            <div key={bi}>{text}</div>
                          );
                        })}
                      </div>
                    )}
                    <a
                      href={getPlatformUrl(p, product, result.directLinks)}
                      onClick={() => {
                        const perPlatformSavings = Math.max(0, parsePx(p.listedPrice) - parsePx(p.effectivePrice));
                        track("buy_click", {
                          product: product.slice(0, 200),
                          platform: p.name,
                          bestPrice: parsePx(p.effectivePrice),
                          savings: perPlatformSavings,
                          source: "leaderboard",
                        });
                        logDeal(
                          product,
                          p.name,
                          parsePx(p.effectivePrice),
                          // Per-platform savings = listedPrice - effectivePrice
                          perPlatformSavings
                        );
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition-all text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500"
                    >
                      View on {p.name} ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Price context */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-3">
            <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest">Price intelligence</div>
            <p className="text-zinc-400 text-sm">{result.priceContext}</p>
            {atl ? (
              <div className="flex items-start gap-2 text-xs">
                <AtlBadge atl={atl} />
              </div>
            ) : null}
            {result.upcomingSales?.length > 0 && (
              <div>
                <div className="text-zinc-600 text-xs mb-2">Upcoming sales</div>
                <div className="flex flex-wrap gap-2">
                  {result.upcomingSales.map((s, i) => (
                    <span key={i} className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-zinc-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Feedback after price results */}
          <FeedbackWidget
            module="price_optimizer"
            productName={product}
            label="Did we find the right product and price?"
          />

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/app/research")}
              className="flex-1 border border-zinc-800 hover:border-zinc-700 text-zinc-400 font-medium rounded-xl py-3 text-sm transition-colors"
            >
              ← Research another
            </button>
            <button
              onClick={() => router.push("/app/savings")}
              className="border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 font-medium rounded-xl px-5 py-3 text-sm transition-colors"
            >
              Savings →
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default function PricePageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="text-zinc-500 text-sm">Loading...</div></div>}>
      <PricePage />
    </Suspense>
  );
}
