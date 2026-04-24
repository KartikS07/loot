"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { saveToWishlist } from "@/app/app/wishlist/page";

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
}

interface PriceResult {
  product: string;
  searchedAt: string;
  platforms: Platform[];
  verdict: {
    action: "buy_now" | "wait";
    bestPlatform: string;
    bestEffectivePrice: string;
    savings: string;
    reason: string;
    waitUntil: string | null;
    expectedWaitPrice: string | null;
  };
  priceContext: string;
  atl: string;
  upcomingSales: string[];
  directLinks?: Record<string, string>; // platform name → direct product page URL
}

// Fallback search URLs when Gemini can't find the direct product page
const PLATFORM_SEARCH: Record<string, (q: string) => string> = {
  // E-commerce
  "Amazon India": (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`,
  "Flipkart": (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`,
  "Meesho": (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`,
  "JioMart": (q) => `https://www.jiomart.com/search#q=${encodeURIComponent(q)}`,
  // Electronics retail
  "Croma": (q) => `https://www.croma.com/searchB?q=${encodeURIComponent(q)}`,
  "Reliance Digital": (q) => `https://www.reliancedigital.in/search?q=${encodeURIComponent(q)}`,
  "Tata Cliq": (q) => `https://www.tatacliq.com/search/?searchCategory=all&text=${encodeURIComponent(q)}`,
  "Vijay Sales": (q) => `https://www.vijaysales.com/search/${encodeURIComponent(q)}`,
  // Quick commerce (same-day, major cities)
  "Blinkit": (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
  "Zepto": (q) => `https://www.zepto.com/search?query=${encodeURIComponent(q)}`,
  "Swiggy Instamart": (q) => `https://www.swiggy.com/instamart/search?query=${encodeURIComponent(q)}`,
};

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
    if (match) return directLinks[match];
  }

  // Priority 2: platform search using the original clean product name from URL param
  const query = (typeof productName === "string" && productName.trim())
    ? productName
    : platform.name;

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

// Parse ₹ price string to integer for sorting; unparseable = Infinity (goes last)
function parsePx(s: unknown): number {
  if (typeof s !== "string") return Infinity;
  const n = parseInt(s.replace(/[^0-9]/g, ""));
  return isNaN(n) ? Infinity : n;
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
    // Also save to localStorage so savings page can show "Did you buy it?" nudge
    const DEALS_KEY = "loot_pending_deals";
    const existing: unknown[] = JSON.parse(localStorage.getItem(DEALS_KEY) ?? "[]");
    const deal = {
      id: `deal_${Date.now()}`,
      productName,
      platform,
      bestPrice,
      marketHighPrice: bestPrice + savings,  // reconstruct for API compatibility
      savedVsHighest: Math.max(0, savings),
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
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);

  // FIX 1: guard against React 18 StrictMode double-invocation
  // AbortController cancels the in-flight request if the effect re-runs or component unmounts
  const abortRef = useRef<AbortController | null>(null);

  const fetchPrices = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setError("");
    setResult(null);
    setLoadingMsg(0);

    try {
      const res = await fetch("/api/price", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, userProfile: getProfile() }),
      });

      if (signal.aborted) return;

      const data = await res.json();
      if (signal.aborted) return;

      if (!res.ok) throw new Error(data.error ?? "Price check failed");
      setResult(data);
    } catch (e) {
      if ((e as Error).name === "AbortError") return; // intentional cancel
      setError((e as Error).message ?? "Something went wrong");
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

    fetchPrices(controller.signal);

    return () => controller.abort(); // cleanup on unmount or product change
  }, [product, fetchPrices]);

  useEffect(() => {
    if (!loading) return;
    setLoadingMsg(0); // reset to start when loading begins
    const id = setInterval(() => {
      setLoadingMsg((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1)); // stop at last, never loop
    }, 2500);
    return () => clearInterval(id);
  }, [loading]);

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
            <p className="text-zinc-400 text-sm">{LOADING_MESSAGES[loadingMsg]}</p>
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

      {result && !loading && (
        <div className="space-y-6">
          {/* Verdict */}
          <div className={`rounded-2xl p-6 border ${
            result.verdict.action === "buy_now" ? "bg-green-400/5 border-green-400/25" : "bg-amber-400/5 border-amber-400/25"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-widest mb-2 ${
                  result.verdict.action === "buy_now" ? "text-green-400" : "text-amber-400"
                }`}>
                  {result.verdict.action === "buy_now" ? "✓ Buy now" : "⏳ Wait"}
                </div>
                <div className="text-white font-black text-2xl mb-1">
                  {px(result.verdict.bestEffectivePrice)}
                  <span className="text-zinc-500 font-normal text-base ml-2">on {px(result.verdict.bestPlatform)}</span>
                </div>
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
                {result.verdict.action === "buy_now" && (() => {
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
                          onClick={() => logDeal(
                            product,
                            result.verdict.bestPlatform ?? "",
                            parsePx(result.verdict.bestEffectivePrice),
                            actualSavings
                          )}
                          className="inline-flex items-center gap-2 bg-green-400 hover:bg-green-300 text-black font-black rounded-xl px-6 py-3 text-sm transition-colors"
                        >
                          Buy on {result.verdict.bestPlatform} →
                        </a>
                      )}
                      {/* Save button lives next to Buy — easier to find */}
                      <button
                        onClick={() => {
                          const saved = saveToWishlist({
                            productName: product,
                            platform: result.verdict.bestPlatform,
                            bestPrice: parsePx(result.verdict.bestEffectivePrice),
                          });
                          if (saved) setWishlisted(true);
                        }}
                        title={wishlisted ? "Saved to wishlist" : "Save to wishlist"}
                        className={`border rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                          wishlisted
                            ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                            : "border-zinc-700 hover:border-zinc-500 text-zinc-400"
                        }`}
                      >
                        {wishlisted ? "♥ Saved" : "♡ Save"}
                      </button>
                    </div>
                  );
                })()}
              </div>
              <div className="text-4xl shrink-0">
                {result.verdict.action === "buy_now" ? "🎯" : "⏳"}
              </div>
            </div>
          </div>

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
                      {p.discountApplied && p.discountApplied !== "none" && p.discountApplied !== "No applicable discounts found" && (
                        <span className="text-blue-400">{p.discountApplied}</span>
                      )}
                      {p.couponCode && typeof p.couponCode === "string" && (
                        <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded text-amber-400">
                          {p.couponCode}
                        </span>
                      )}
                      {p.deliveryEta && <span>📦 {p.deliveryEta}</span>}
                      {p.returnPolicy && <span>↩ {p.returnPolicy}</span>}
                      {p.sellerTrust && <span className="text-zinc-700">{p.sellerTrust}</span>}
                    </div>
                    <a
                      href={getPlatformUrl(p, product, result.directLinks)}
                      onClick={() => logDeal(
                        product,
                        p.name,
                        parsePx(p.effectivePrice),
                        // Per-platform savings = listedPrice - effectivePrice
                        Math.max(0, parsePx(p.listedPrice) - parsePx(p.effectivePrice))
                      )}
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
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-600">All-time low:</span>
              <span className="text-amber-400 font-medium">{px(result.atl)}</span>
            </div>
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
      )}
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
