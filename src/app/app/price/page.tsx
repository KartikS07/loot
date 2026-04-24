"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

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
}

function getProfile() {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("loot_profile") ?? "{}"); }
  catch { return {}; }
}

const LOADING_MESSAGES = [
  "Scanning Amazon India...",
  "Checking Flipkart prices...",
  "Searching Croma & Reliance Digital...",
  "Applying your HDFC card discount...",
  "Checking for active coupon codes...",
  "Analysing price history...",
  "Computing your best deal...",
];

function PricePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const product = searchParams.get("product") ?? "";
  const [result, setResult] = useState<PriceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState(0);

  useEffect(() => {
    if (!product) return;
    fetchPrices();
  }, [product]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMsg((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  async function fetchPrices() {
    setLoading(true);
    setError("");
    setResult(null);
    const profile = getProfile();
    try {
      const res = await fetch("/api/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, userProfile: profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button onClick={() => router.push("/app/research")} className="text-zinc-600 hover:text-zinc-400 text-sm mb-4 block transition-colors">
          ← Back to research
        </button>
        <h1 className="text-2xl font-black text-white leading-tight">{product}</h1>
        <p className="text-zinc-500 text-sm mt-1">Price comparison across Indian platforms</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-6">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-8 text-center">
            <div className="flex justify-center gap-1 mb-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-zinc-400 text-sm transition-all">{LOADING_MESSAGES[loadingMsg]}</p>
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

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-400/10 border border-red-400/20 rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={fetchPrices} className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-5 py-2 text-sm transition-colors">
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6">

          {/* Verdict — the most important part */}
          <div className={`rounded-2xl p-6 border ${result.verdict.action === "buy_now"
            ? "bg-green-400/5 border-green-400/25"
            : "bg-amber-400/5 border-amber-400/25"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className={`text-xs font-semibold uppercase tracking-widest mb-2 ${result.verdict.action === "buy_now" ? "text-green-400" : "text-amber-400"}`}>
                  {result.verdict.action === "buy_now" ? "✓ Buy now" : "⏳ Wait"}
                </div>
                <div className="text-white font-black text-2xl mb-1">
                  {result.verdict.bestEffectivePrice}
                  <span className="text-zinc-500 font-normal text-base ml-2">on {result.verdict.bestPlatform}</span>
                </div>
                <div className={`text-sm font-medium mb-3 ${result.verdict.action === "buy_now" ? "text-green-400" : "text-amber-400"}`}>
                  {result.verdict.savings}
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{result.verdict.reason}</p>
                {result.verdict.action === "wait" && result.verdict.waitUntil && (
                  <p className="text-amber-400/70 text-xs mt-2">
                    Wait until: {result.verdict.waitUntil}
                    {result.verdict.expectedWaitPrice && ` — expected ${result.verdict.expectedWaitPrice}`}
                  </p>
                )}
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
              {result.platforms
                .sort((a, b) => {
                  const pa = parseInt(a.effectivePrice.replace(/[^0-9]/g, ""));
                  const pb = parseInt(b.effectivePrice.replace(/[^0-9]/g, ""));
                  return pa - pb;
                })
                .map((p, i) => (
                  <div
                    key={p.name}
                    className={`bg-zinc-950 rounded-2xl p-5 border transition-all ${
                      i === 0 && p.inStock ? "border-green-400/25" : "border-zinc-900"
                    } ${!p.inStock ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {i === 0 && p.inStock && (
                            <span className="text-[10px] bg-green-400/15 text-green-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Best deal
                            </span>
                          )}
                          <span className="text-white font-bold text-sm">{p.name}</span>
                          {!p.inStock && (
                            <span className="text-[10px] bg-red-400/15 text-red-400 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Out of stock
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-white font-black text-xl">{p.effectivePrice}</span>
                          {p.listedPrice !== p.effectivePrice && (
                            <span className="text-zinc-600 text-sm line-through">{p.listedPrice}</span>
                          )}
                          {p.savings && p.savings !== "₹0" && (
                            <span className="text-green-400 text-xs font-semibold">{p.savings} off</span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                          {p.discountApplied && p.discountApplied !== "none" && (
                            <span className="text-blue-400">{p.discountApplied}</span>
                          )}
                          {p.couponCode && (
                            <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded text-amber-400">
                              {p.couponCode}
                            </span>
                          )}
                          <span>📦 {p.deliveryEta}</span>
                          <span>↩ {p.returnPolicy}</span>
                          <span className="text-zinc-700">{p.sellerTrust}</span>
                        </div>
                      </div>
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
              <span className="text-amber-400 font-medium">{result.atl}</span>
            </div>
            {result.upcomingSales?.length > 0 && (
              <div>
                <div className="text-zinc-600 text-xs mb-2">Upcoming sales</div>
                <div className="flex flex-wrap gap-2">
                  {result.upcomingSales.map((s) => (
                    <span key={s} className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full text-zinc-400">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/app/research")}
              className="flex-1 border border-zinc-800 hover:border-zinc-700 text-zinc-400 font-medium rounded-xl py-3 text-sm transition-colors"
            >
              ← Research another product
            </button>
            <button
              onClick={() => router.push("/app/savings")}
              className="border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 font-medium rounded-xl px-5 py-3 text-sm transition-colors"
            >
              View savings →
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
