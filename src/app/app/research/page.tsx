"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Recommendation {
  rank: number;
  name: string;
  tagline: string;
  whyForYou: string;
  expertScore: number;
  specs: Record<string, string>;
  pros: string[];
  cons: string[];
  estimatedPrice: string;
  platformHint: string;
  imageQuery: string;
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

function ProductCard({ rec, onPriceOptimize }: { rec: Recommendation; onPriceOptimize: (name: string) => void }) {
  const [expanded, setExpanded] = useState(false);

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
            <div className="text-amber-400 font-black text-lg">{rec.estimatedPrice}</div>
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
            Find best price →
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-2.5 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-400 text-sm transition-colors"
          >
            {expanded ? "Less" : "Specs"}
          </button>
        </div>
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
  const inputRef = useRef<HTMLInputElement>(null);

  const profile = typeof window !== "undefined" ? getProfile() : {};

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function runResearch(msgs: Message[]) {
    setLoading(true);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msgs,
          userProfile: profile,
          sessionId,
        }),
      });
      const data: ResearchResult = await res.json();
      setResult(data);

      if (data.phase === "clarify" && data.clarifyQuestion) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.clarifyQuestion! },
        ]);
      }
    } catch {
      setResult({ phase: "error", error: "Something went wrong. Try again." });
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
    router.push(`/app/price?product=${encodeURIComponent(productName)}`);
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
            {messages.length <= 2 ? "Researching across expert sources..." : "Analysing your answers..."}
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
                <ProductCard key={rec.rank} rec={rec} onPriceOptimize={handlePriceOptimize} />
              ))}
            </div>
          </div>
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
    </div>
  );
}
