"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { RazorpayCheckoutButton } from "@/components/RazorpayCheckoutButton";
import { DeepDiveModal } from "@/components/DeepDiveModal";
import { saveToWishlist } from "@/app/app/wishlist/page";
import { toast } from "sonner";
import { track } from "@/lib/analytics";

interface Recommendation {
  rank: number;
  name: string;
  tagline: string;
  whyForYou: string;
  expertScore: number;
  specs: Record<string, string>;
  pros: string[];
  cons: string[];
  platformHint: string;
  imageQuery?: string;
}

interface ResearchResult {
  phase: "clarify" | "results" | "error";
  clarifyQuestion?: string;
  educationLayer?: {
    categoryGuide: string;
    commonMistakes: string[];
    insiderTip: string;
  };
  recommendations?: Recommendation[];
  proTips?: string[];
  whatReviewsDontTellYou?: string[];
  summary?: string;
  error?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

function getProfile() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("loot_profile") ?? "{}");
  } catch { return {}; }
}

function getStoredEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("loot_email") ?? "";
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
        <div
          className="bg-amber-400 h-1.5 rounded-full transition-all"
          style={{ width: `${(score / 10) * 100}%` }}
        />
      </div>
      <span className="text-amber-400 font-bold text-sm tabular-nums">{score}/10</span>
    </div>
  );
}

function ProductCard({
  rec,
  onPriceOptimize,
  onDeepDive,
  isPremium,
}: {
  rec: Recommendation;
  onPriceOptimize: (name: string) => void;
  onDeepDive: (rec: Recommendation) => void;
  isPremium: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);

  function handleWishlist() {
    const result = saveToWishlist({ productName: rec.name, platform: rec.platformHint });
    if (result.status === "added") {
      setWishlisted(true);
      toast.success("Saved to wishlist.");
    } else if (result.status === "already") {
      setWishlisted(true);
      toast("Already in your wishlist.");
    } else {
      toast.error("Wishlist is full (50 max). Remove an item first.");
    }
  }

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-all">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-400/10 border border-amber-400/20 rounded-xl flex items-center justify-center text-amber-400 font-black text-sm shrink-0">
              {rec.rank}
            </div>
            <div>
              <h3 className="font-black text-white text-lg leading-tight">{rec.name}</h3>
              <p className="text-zinc-500 text-xs mt-0.5">{rec.tagline}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-zinc-600 text-xs">{rec.platformHint}</div>
          </div>
        </div>

        <ScoreBar score={rec.expertScore} />

        <div className="mt-4 bg-amber-400/5 border border-amber-400/10 rounded-xl px-4 py-3">
          <span className="text-amber-400 text-xs font-semibold">Why this for you  </span>
          <span className="text-zinc-300 text-xs">{rec.whyForYou}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-2">Pros</div>
            <ul className="space-y-1">
              {rec.pros.slice(0, 3).map((p, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                  <span className="text-green-400 shrink-0 mt-0.5">+</span>{p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-2">Cons</div>
            <ul className="space-y-1">
              {rec.cons.slice(0, 3).map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-400">
                  <span className="text-red-400 shrink-0 mt-0.5">−</span>{c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {expanded && Object.keys(rec.specs).length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-900">
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-3">Key specs</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(rec.specs).map(([k, v]) => (
                <div key={k} className="bg-zinc-900 rounded-lg px-3 py-2">
                  <div className="text-zinc-600 text-[10px] uppercase tracking-wide">{k}</div>
                  <div className="text-white text-xs font-medium mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-900">
          <button
            onClick={() => onPriceOptimize(rec.name)}
            className="flex-1 bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl py-2.5 text-sm transition-colors"
          >
            Get live price →
          </button>
          <button
            onClick={handleWishlist}
            title={wishlisted ? "Saved to wishlist" : "Save to wishlist"}
            className={`px-3 py-2.5 border rounded-xl text-sm transition-all ${
              wishlisted
                ? "border-amber-400/40 text-amber-400 bg-amber-400/10"
                : "border-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {wishlisted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            )}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 text-sm transition-colors"
          >
            {expanded ? "Less" : "Specs"}
          </button>
        </div>

        {/* Expert Deep Dive — opens modal. Locked icon for non-premium. */}
        <button
          onClick={() => onDeepDive(rec)}
          className={`w-full mt-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all border ${
            isPremium
              ? "bg-amber-400/10 border-amber-400/30 text-amber-300 hover:bg-amber-400/15 hover:border-amber-400/50"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-amber-400/30 hover:text-amber-300"
          }`}
        >
          <span>Expert Deep Dive</span>
          <span>{isPremium ? "↗" : "🔒"}</span>
        </button>
      </div>
    </div>
  );
}

function DeepModeToggle({
  isPremium,
  enabled,
  onToggle,
}: {
  isPremium: boolean;
  enabled: boolean;
  onToggle: () => void;
}) {
  const active = isPremium && enabled;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
        active
          ? "bg-amber-400/15 border-amber-400/40 text-amber-300"
          : isPremium
            ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
            : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-amber-400/30 hover:text-amber-300"
      }`}
    >
      <span
        className={`inline-block w-6 h-3 rounded-full relative transition-colors ${
          active ? "bg-amber-400" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${
            active ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      <span>
        {active ? "Deep Mode ✓" : "Go deeper — Premium"}
      </span>
      {!isPremium && <span className="text-[10px]">🔒</span>}
    </button>
  );
}

function PremiumPaywallCard({
  email,
  onClose,
  onUnlocked,
}: {
  email: string;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  return (
    <div className="mt-3 bg-zinc-950 border border-amber-400/30 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">
              Loot Premium
            </span>
            <span className="text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-full px-2 py-0.5">
              ₹199 lifetime
            </span>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Unlocks <span className="text-white font-semibold">Deep Mode</span> (10 picks,
            long-form buying guide, pro tips, &ldquo;what reviews don&apos;t tell you&rdquo;)
            plus <span className="text-white font-semibold">Expert Deep Dive</span> on
            every recommendation. Pay once, yours forever.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 text-lg leading-none shrink-0"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        {email ? (
          <RazorpayCheckoutButton
            kind="premium"
            email={email}
            label="Unlock Premium — ₹199"
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-5 py-2.5 text-sm transition-colors disabled:opacity-60"
            onSuccess={() => onUnlocked()}
          />
        ) : (
          <div className="text-xs text-zinc-500">
            Complete onboarding first — we need your email to link the unlock.
          </div>
        )}
        <span className="text-[11px] text-zinc-600">Secure checkout via Razorpay</span>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [clarifyInput, setClarifyInput] = useState("");
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [email, setEmail] = useState("");
  const [deepModeEnabled, setDeepModeEnabled] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [deepDiveProduct, setDeepDiveProduct] = useState<Recommendation | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Paste-URL flow
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const profile = typeof window !== "undefined" ? getProfile() : {};

  // Read email once mounted so SSR stays deterministic.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage hydration is the whole point
    setEmail(getStoredEmail());
  }, []);

  // Premium status — skip query until we have an email. Auto-refetches on Convex
  // mutation (e.g. after a successful Razorpay premium unlock patches users.premiumTier).
  const premiumStatus = useQuery(
    api.users.getPremiumStatus,
    email ? { email } : "skip",
  );
  const isPremium = premiumStatus?.isPremium === true;

  // No reset-on-premium-flip effect: server-side /api/research re-checks premium
  // via Convex and downgrades silently if false. The toggle UI is also disabled
  // when !isPremium, so deepModeEnabled cannot become invalid in practice.

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function runResearch(msgs: Message[]) {
    setLoading(true);
    track("research_run", {
      deep: deepModeEnabled && isPremium,
      messageCount: msgs.length,
      query: msgs[msgs.length - 1]?.content?.slice(0, 200),
    });
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          userProfile: profile,
          sessionId,
          deep: deepModeEnabled && isPremium,
          email,
        }),
      });
      const data: ResearchResult = await res.json();
      setResult(data);
      track("research_result", {
        phase: data.phase,
        recommendationsCount: data.recommendations?.length ?? 0,
      });

      if (data.phase === "clarify" && data.clarifyQuestion) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.clarifyQuestion! },
        ]);
      }
    } catch {
      setResult({ phase: "error", error: "Couldn't fetch recommendations. The model may be busy — try again in a moment." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    const userMsg: Message = { role: "user", content: query };
    const newMessages = [userMsg];
    setMessages(newMessages);
    setQuery("");
    setResult(null);
    await runResearch(newMessages);
  }

  async function handleClarify(e: React.FormEvent) {
    e.preventDefault();
    if (!clarifyInput.trim() || loading) return;
    const userMsg: Message = { role: "user", content: clarifyInput };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setClarifyInput("");
    await runResearch(newMessages);
  }

  function handlePriceOptimize(productName: string) {
    track("price_check_from_research", { productName: productName.slice(0, 200) });
    router.push(`/app/price?product=${encodeURIComponent(productName)}`);
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = urlInput.trim();
    if (!url || urlLoading) return;
    setUrlError(null);
    setUrlLoading(true);
    try {
      const res = await fetch("/api/url-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as {
        productName?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.productName) {
        setUrlError(
          data.message ?? "Couldn't read that URL — try searching by name instead.",
        );
        setUrlLoading(false);
        return;
      }
      // Skip the research step — jump straight to the price page.
      router.push(`/app/price?product=${encodeURIComponent(data.productName)}`);
    } catch {
      setUrlError("Couldn't read that URL — try searching by name instead.");
      setUrlLoading(false);
    }
  }

  function handleDeepDive(rec: Recommendation) {
    setDeepDiveProduct(rec);
  }

  const showSearch = messages.length === 0;
  const showClarify = result?.phase === "clarify";
  const showResults = result?.phase === "results";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      {showSearch && (
        <div className="text-center mb-12 pt-8">
          <h1 className="text-4xl font-black mb-3">What are you looking for?</h1>
          <p className="text-zinc-500">Tell Loot what you want — in plain English.</p>
        </div>
      )}

      {/* Search input */}
      {showSearch && (
        <form onSubmit={handleSearch}>
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. noise-cancelling headphones for travel, under ₹25,000"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10 transition-all text-base"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-2xl px-6 py-4 transition-colors disabled:opacity-40"
            >
              Search
            </button>
          </div>

          {/* Deep Mode toggle row */}
          <div className="mt-3 flex items-center gap-3">
            <DeepModeToggle
              isPremium={isPremium}
              enabled={deepModeEnabled}
              onToggle={() => {
                if (isPremium) {
                  setDeepModeEnabled((v) => !v);
                } else {
                  setShowPaywall((v) => !v);
                }
              }}
            />
            {isPremium && deepModeEnabled && (
              <span className="text-[11px] text-zinc-500">
                10 picks · long-form guide · pro tips
              </span>
            )}
          </div>

          {/* Paywall card (non-premium, toggle clicked) */}
          {!isPremium && showPaywall && (
            <PremiumPaywallCard
              email={email}
              onClose={() => setShowPaywall(false)}
              onUnlocked={() => {
                // Convex query auto-refetches on users.premiumTier change.
                // Close the card immediately — toggle re-renders as active next tick.
                setShowPaywall(false);
                setDeepModeEnabled(true);
              }}
            />
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {[
              "Best budget TWS earphones under ₹3,000",
              "Gaming laptop for ₹80,000",
              "Air purifier for a 300 sq ft room",
              "DSLR camera for a beginner",
            ].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQuery(s)}
                className="text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full px-3 py-1.5 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </form>
      )}

      {/* Paste-URL shortcut — skips research, jumps to price page */}
      {showSearch && (
        <div className="mt-8 pt-6 border-t border-zinc-900">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">
              …or paste a product URL
            </span>
            <span className="text-[10px] text-zinc-600">
              Amazon, Flipkart, Croma — we&apos;ll jump straight to prices
            </span>
          </div>
          <form onSubmit={handleUrlSubmit}>
            <div className="flex gap-3">
              <input
                type="url"
                inputMode="url"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                placeholder="https://www.amazon.in/…"
                maxLength={2000}
                disabled={urlLoading}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10 transition-all disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!urlInput.trim() || urlLoading}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-2xl px-5 py-3 text-sm transition-colors disabled:opacity-40"
              >
                {urlLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-1 h-1 bg-amber-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </span>
                    Reading URL…
                  </span>
                ) : (
                  "Analyze"
                )}
              </button>
            </div>
            {urlError && (
              <div className="mt-3 text-xs text-red-400/80 bg-red-400/5 border border-red-400/20 rounded-xl px-3 py-2">
                {urlError}
              </div>
            )}
            {urlLoading && !urlError && (
              <div className="mt-3 text-[11px] text-zinc-500">
                Extracting product name — this takes a few seconds.
              </div>
            )}
          </form>
        </div>
      )}

      {/* Conversation thread */}
      {messages.length > 0 && (
        <div className="space-y-3 mb-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xl px-4 py-3 rounded-2xl text-sm ${
                  m.role === "user"
                    ? "bg-amber-400/10 border border-amber-400/20 text-white"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-300"
                }`}
              >
                {m.role === "assistant" && (
                  <span className="text-amber-400 font-semibold text-xs block mb-1">Loot</span>
                )}
                {m.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 py-6">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <span className="text-zinc-500 text-sm">
            {deepModeEnabled && isPremium
              ? "Deep research in progress — this takes longer…"
              : messages.length <= 2
                ? "Researching across expert sources..."
                : "Analysing your answers..."}
          </span>
        </div>
      )}

      {/* Clarify input */}
      {showClarify && !loading && (
        <form onSubmit={handleClarify} className="flex gap-3 mb-8">
          <input
            type="text"
            value={clarifyInput}
            onChange={(e) => setClarifyInput(e.target.value)}
            placeholder="Your answer..."
            autoFocus
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/50 transition-all"
          />
          <button
            type="submit"
            disabled={!clarifyInput.trim()}
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-2xl px-6 py-4 transition-colors disabled:opacity-40"
          >
            →
          </button>
        </form>
      )}

      {/* Results */}
      {showResults && !loading && result && (
        <div className="space-y-8">
          {/* Education layer */}
          {result.educationLayer && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
                Before you decide
              </div>
              <p className="text-zinc-300 text-sm leading-relaxed mb-4">
                {result.educationLayer.categoryGuide}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-red-400/70 uppercase tracking-widest mb-2">Common mistakes</div>
                  <ul className="space-y-1.5">
                    {result.educationLayer.commonMistakes.map((m, i) => (
                      <li key={i} className="text-xs text-zinc-500 flex items-start gap-2">
                        <span className="text-red-400/50 shrink-0 mt-0.5">▸</span>{m}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl p-4">
                  <div className="text-xs text-amber-400 uppercase tracking-widest mb-2">Insider tip</div>
                  <p className="text-xs text-zinc-400">{result.educationLayer.insiderTip}</p>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black">Your top picks</h2>
              <button
                onClick={() => { setMessages([]); setResult(null); }}
                className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
              >
                New search
              </button>
            </div>
            <div className="grid gap-4">
              {result.recommendations?.map((rec) => (
                <ProductCard
                  key={rec.rank}
                  rec={rec}
                  onPriceOptimize={handlePriceOptimize}
                  onDeepDive={handleDeepDive}
                  isPremium={isPremium}
                />
              ))}
            </div>
          </div>

          {/* Deep Mode extras — only present when premium deep response returns them */}
          {(result.proTips?.length || result.whatReviewsDontTellYou?.length) ? (
            <div className="grid md:grid-cols-2 gap-4">
              {result.proTips && result.proTips.length > 0 && (
                <div className="bg-zinc-950 border border-amber-400/20 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">
                      Pro tips
                    </span>
                    <span className="text-[10px] text-zinc-600 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
                      Premium
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {result.proTips.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed">
                        <span className="text-amber-400 shrink-0 mt-0.5">★</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.whatReviewsDontTellYou && result.whatReviewsDontTellYou.length > 0 && (
                <div className="bg-zinc-950 border border-amber-400/20 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">
                      What reviews don&apos;t tell you
                    </span>
                    <span className="text-[10px] text-zinc-600 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
                      Premium
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {result.whatReviewsDontTellYou.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-zinc-300 leading-relaxed">
                        <span className="text-amber-400 shrink-0 mt-0.5">▸</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {/* Feedback after results */}
          <FeedbackWidget
            module="researcher"
            productName={messages[0]?.content ?? "unknown"}
            sessionId={sessionId}
            label="Did these recommendations help?"
          />
        </div>
      )}

      {/* Error */}
      {result?.phase === "error" && (
        <div className="bg-red-400/10 border border-red-400/20 rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm mb-3">{result.error}</p>
          <button
            onClick={() => { setMessages([]); setResult(null); }}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Expert Deep Dive modal */}
      <DeepDiveModal
        open={deepDiveProduct !== null}
        onOpenChange={(next) => { if (!next) setDeepDiveProduct(null); }}
        product={
          deepDiveProduct
            ? {
                name: deepDiveProduct.name,
                specs: deepDiveProduct.specs,
                pros: deepDiveProduct.pros,
                cons: deepDiveProduct.cons,
                tagline: deepDiveProduct.tagline,
              }
            : null
        }
        email={email}
        isPremium={isPremium}
      />
    </div>
  );
}
