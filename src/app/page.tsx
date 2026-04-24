"use client";

import { useState, useEffect } from "react";
import { joinWaitlist } from "./actions";

const PLATFORMS = ["Amazon", "Flipkart", "Croma", "Blinkit", "Zepto", "Meesho", "JioMart", "Vijay Sales", "Reliance Digital", "Tata Cliq", "Swiggy Instamart", "Brand Sites"];
const BANK_CARDS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "IDFC"];

function WaitlistForm({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setMessage("Enter a valid email.");
      return;
    }
    setStatus("loading");
    const result = await joinWaitlist(email, source);
    if (result.success) {
      setStatus("success");
      setMessage(result.alreadyJoined ? "Already in. We'll ping you." : "You're in. We'll ping you when Loot goes live.");
    } else {
      setStatus("error");
      setMessage(result.error ?? "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="space-y-3">
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl px-6 py-4">
          <div className="text-amber-400 font-semibold mb-0.5">You&apos;re on the list ✓</div>
          <div className="text-zinc-400 text-sm">{message}</div>
        </div>
        <a
          href="/app"
          className="flex items-center justify-center gap-2 w-full bg-amber-400 hover:bg-amber-300 text-black font-black rounded-xl px-6 py-3.5 text-sm transition-colors"
        >
          Try Loot now — it&apos;s free →
        </a>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/10 transition-all text-sm"
          disabled={status === "loading"}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-black font-bold rounded-xl px-6 py-3.5 text-sm transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "loading" ? "Saving..." : "Get early access"}
        </button>
      </form>
      {status === "error" && <p className="text-red-400 text-xs mt-2">{message}</p>}
      <p className="text-zinc-700 text-xs mt-3">Free for early users · No spam · Unsubscribe anytime</p>
    </div>
  );
}

export default function LandingPage() {
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    // Detect returning user — has a saved profile from a previous session
    const profile = localStorage.getItem("loot_profile");
    if (profile) setIsReturning(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight text-amber-400">Loot</span>
          <span className="text-[10px] text-zinc-600 font-semibold uppercase tracking-widest mt-1.5">beta</span>
        </div>
        {isReturning ? (
          <a
            href="/app"
            className="bg-amber-400 hover:bg-amber-300 text-black font-bold text-sm rounded-xl px-4 py-2 transition-colors"
          >
            Open Loot →
          </a>
        ) : (
          <a href="#waitlist" className="text-sm font-medium text-zinc-400 hover:text-amber-400 transition-colors">
            Get early access →
          </a>
        )}
      </nav>

      {/* Hero */}
      <section className="px-6 pt-16 pb-24 max-w-6xl mx-auto">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
            <span className="text-amber-400 text-xs font-semibold tracking-wide uppercase">
              AI shopping assistant · India-first
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            The best price{" "}
            <span className="text-amber-400">isn&apos;t</span>{" "}
            the one<br className="hidden sm:block" /> you found.
          </h1>

          <p className="text-xl text-zinc-400 max-w-2xl mb-4 leading-relaxed">
            You open 20 tabs. Check Amazon, Flipkart, Croma. Hunt for coupon codes.
            Calculate your HDFC discount manually. Still not sure.{" "}
            <span className="text-white font-medium">
              Loot does all of it in 60 seconds.
            </span>
          </p>

          <p className="text-zinc-600 text-base italic mb-12">
            &ldquo;Not just a deal. A loot.&rdquo;
          </p>

          <div id="waitlist" className="max-w-md">
            <WaitlistForm source="hero" />
            <p className="text-zinc-700 text-xs mt-4">
              Already signed up?{" "}
              <a href="/app" className="text-amber-400/70 hover:text-amber-400 transition-colors underline underline-offset-2">
                Open Loot →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Platform strip */}
      <div className="border-y border-zinc-900 py-4">
        <div className="flex items-center gap-6 px-6 max-w-6xl mx-auto overflow-x-auto scrollbar-hide">
          <span className="text-zinc-600 text-xs font-semibold uppercase tracking-widest shrink-0">Scans live</span>
          {PLATFORMS.map((p) => (
            <span key={p} className="text-zinc-500 text-sm shrink-0">{p}</span>
          ))}
        </div>
      </div>

      {/* Problem vs Solution */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">

          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8">
            <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-6">What you do today</div>
            <div className="space-y-3.5">
              {[
                "Open Amazon tab",
                "Open Flipkart tab",
                "Open Croma, Reliance Digital, Vijay Sales...",
                "Google 'coupon code Amazon April 2026'",
                "Manually calculate HDFC card discount",
                "Check if Big Billion Days is coming",
                "Watch 3 YouTube reviews",
                "Buy anyway at the wrong price",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-zinc-700 text-xs font-mono mt-0.5 shrink-0 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-zinc-400 text-sm">{step}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-zinc-900 flex items-center gap-2">
              <span className="text-zinc-500 text-sm">Time spent:</span>
              <span className="text-white font-black text-xl">2–4 hours</span>
            </div>
          </div>

          <div className="bg-zinc-950 border border-amber-400/20 rounded-3xl p-8">
            <div className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-6">With Loot</div>
            <div className="space-y-3.5">
              {[
                { step: "Tell Loot what you want", t: "10s" },
                { step: "Answer 3 quick questions about your use case", t: "30s" },
                { step: "Read your personalised top-5 shortlist", t: "15s" },
                { step: "See effective prices across 12 platforms", t: "20s" },
                { step: "Know if now is the right time to buy", t: "5s" },
                { step: "One tap to checkout", t: "10s" },
              ].map(({ step, t }, i) => (
                <div key={i} className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="w-4 h-4 bg-amber-400/15 text-amber-400 text-[10px] font-bold rounded-full flex items-center justify-center mt-0.5 shrink-0">✓</span>
                    <span className="text-zinc-300 text-sm">{step}</span>
                  </div>
                  <span className="text-amber-400/50 text-xs font-mono shrink-0 tabular-nums">{t}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-amber-400/10 flex items-center gap-2">
              <span className="text-zinc-500 text-sm">Time spent:</span>
              <span className="text-amber-400 font-black text-xl">&lt; 90 seconds</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black mb-3">Two modules. One verdict.</h2>
          <p className="text-zinc-500 max-w-lg mx-auto">
            Find the right product. Find the right price. Most apps do neither well.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8">
            <div className="text-3xl mb-5">🔍</div>
            <h3 className="text-xl font-black mb-3">The Researcher</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              From &ldquo;I want good headphones&rdquo; to a trusted top-5 shortlist. Loot synthesises
              Wirecutter, RTINGS, Reddit, and spec sheets — weighted to your use case, budget, and expertise.
            </p>
            <ul className="space-y-2">
              {[
                "Adaptive clarification — not a 20-question form",
                "Category buying guide before you decide",
                "Personalised expert score per product",
                "Pros & cons mapped to your specific scenario",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-blue-400 text-xs mt-1 shrink-0">▸</span>
                  <span className="text-zinc-500 text-xs">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8">
            <div className="text-3xl mb-5">💰</div>
            <h3 className="text-xl font-black mb-3">The Price Optimizer</h3>
            <p className="text-zinc-400 text-sm leading-relaxed mb-6">
              Every platform. Every bank offer. Every coupon. Stacked correctly per platform T&amp;Cs.
              Your actual out-of-pocket cost — not the fake strikethrough price.
            </p>
            <ul className="space-y-2">
              {[
                `Bank card discounts: ${BANK_CARDS.join(", ")}`,
                "UPI cashback: PhonePe, GPay, Paytm, Amazon Pay",
                "1-year price history + all-time low indicator",
                "Buy now or wait — decisive verdict with reasoning",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-green-400 text-xs mt-1 shrink-0">▸</span>
                  <span className="text-zinc-500 text-xs">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: "📅",
              title: "Sale Radar",
              desc: "Amazon GIF, Flipkart BBD, Croma Blockbuster. Historical discounts for your product in each past sale. Expected price if you wait.",
              highlight: false,
            },
            {
              icon: "🔔",
              title: "Wishlist & Alerts",
              desc: "Track up to 50 products. Get pinged when your item drops below your target or hits an all-time low across all 12 platforms.",
              highlight: false,
            },
            {
              icon: "🃏",
              title: "Loot Report",
              desc: "Your personal savings card. How much you saved. Your best loot. Your shopping persona. Share it. Flex it.",
              highlight: true,
            },
          ].map(({ icon, title, desc, highlight }) => (
            <div
              key={title}
              className={`rounded-2xl p-6 border ${highlight ? "bg-zinc-950 border-amber-400/20" : "bg-zinc-950 border-zinc-900"}`}
            >
              <div className="text-2xl mb-4">{icon}</div>
              <h3 className="font-bold text-base mb-2">{title}</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Viral hook — Loot Report mockup */}
      <section className="px-6 pb-24 max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-amber-400/5 to-zinc-950 border border-amber-400/15 rounded-3xl p-10 md:p-16 text-center">
          <p className="text-zinc-600 text-sm mb-8">preview — your loot report</p>

          <div className="inline-block bg-[#0a0a0a] border border-zinc-800 rounded-2xl p-6 text-left w-64 mb-10 shadow-2xl shadow-amber-400/5">
            <div className="flex items-center justify-between mb-5">
              <span className="text-amber-400 font-black text-base">Loot</span>
              <span className="text-zinc-700 text-xs">2026</span>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Total saved</div>
                <div className="text-white text-4xl font-black">₹18,450</div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-900">
                <div>
                  <div className="text-zinc-600 text-[10px] mb-1">Loots</div>
                  <div className="text-white font-bold text-xl">14</div>
                </div>
                <div>
                  <div className="text-zinc-600 text-[10px] mb-1">Best loot</div>
                  <div className="text-amber-400 font-bold text-sm">−₹4,200</div>
                </div>
              </div>
              <div className="pt-3 border-t border-zinc-900">
                <div className="text-zinc-600 text-[10px] mb-1">Shopping persona</div>
                <div className="text-white font-semibold text-sm">Value Hunter 🎯</div>
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-black mb-3">What&apos;s your Loot Report?</h2>
          <p className="text-zinc-500 mb-10 max-w-md mx-auto">
            Be one of the first to find out exactly how much you&apos;ve been overpaying —
            and what you&apos;ll save from here on.
          </p>

          <div className="max-w-md mx-auto">
            <WaitlistForm source="loot_report" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 px-6 py-8 max-w-6xl mx-auto flex items-center justify-between">
        <span className="text-amber-400 font-black text-lg">Loot</span>
        <span className="text-zinc-700 text-sm italic">Not just a deal. A loot.</span>
      </footer>
    </div>
  );
}
