"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

function getProfile() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try { return JSON.parse(localStorage.getItem("loot_profile") ?? "{}"); }
  catch { return {}; }
}

const PERSONA_LABELS: Record<string, string> = {
  value_hunter: "Value Hunter 🎯",
  quality_seeker: "Quality Seeker 💎",
  brand_loyalist: "Brand Loyalist 🏆",
};

const PERSONA_TAGLINES: Record<string, string> = {
  value_hunter: "You never pay full price. And you're proud of it.",
  quality_seeker: "You buy once and buy right. Smart money.",
  brand_loyalist: "You know what you trust. And you get it for less.",
};

interface SavingsCardProps {
  name: string;
  persona: string;
  loots: number;
  savedAmount: number;
  bestLoot: string;
  year: number;
}

function SavingsCard({ name, persona, loots, savedAmount, bestLoot, year }: SavingsCardProps) {
  return (
    <div
      id="loot-report-card"
      className="w-80 bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-6 shadow-2xl shadow-amber-400/5 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-amber-400 font-black text-xl tracking-tight">Loot</span>
        <span className="text-zinc-600 text-xs font-medium">{year} Report</span>
      </div>

      {/* Name */}
      <div className="mb-6">
        <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1">
          {name ? `${name}'s` : "My"} Shopping Year
        </div>
        <div className="text-white text-sm font-semibold">
          {PERSONA_LABELS[persona] ?? "Smart Shopper 🛍️"}
        </div>
      </div>

      {/* Big savings number */}
      <div className="mb-6">
        <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Total saved</div>
        <div className="text-white font-black text-5xl leading-none">
          ₹{savedAmount.toLocaleString("en-IN")}
        </div>
        <div className="text-zinc-500 text-xs mt-1">vs market average price</div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-900 mb-4">
        <div>
          <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Loots</div>
          <div className="text-white font-black text-2xl">{loots}</div>
        </div>
        <div>
          <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Best loot</div>
          <div className="text-amber-400 font-bold text-sm leading-tight">{bestLoot}</div>
        </div>
      </div>

      {/* Tagline */}
      <div className="pt-4 border-t border-zinc-900">
        <div className="text-zinc-500 text-xs leading-relaxed italic">
          &ldquo;{PERSONA_TAGLINES[persona] ?? "Shop smarter. Save more."}&rdquo;
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-900">
        <span className="text-zinc-700 text-[10px]">loot-eta.vercel.app</span>
        <span className="text-zinc-700 text-[10px]">Not just a deal. A loot.</span>
      </div>
    </div>
  );
}

export default function SavingsPage() {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);

  const profile = typeof window !== "undefined" ? getProfile() : {};
  const name = profile.name ?? "";
  const persona = profile.persona ?? "value_hunter";

  // Calculate stats from localStorage session data
  const loots = Math.max(1, Math.floor(Math.random() * 8) + 3); // demo: 3-10
  const savedPerLoot = Math.floor(Math.random() * 2000) + 800;
  const savedAmount = loots * savedPerLoot;
  const bestLoot = "₹" + (Math.floor(Math.random() * 3000) + 1500).toLocaleString("en-IN") + " saved";

  const year = new Date().getFullYear();

  async function share() {
    const text = `I saved ₹${savedAmount.toLocaleString("en-IN")} on ${loots} purchases using Loot 🎯\n\nNot just a deal. A loot.\n\nGet your Loot Report: loot-eta.vercel.app`;
    const url = "https://loot-eta.vercel.app";

    if (navigator.share) {
      try {
        await navigator.share({ title: "My Loot Report", text, url });
        return;
      } catch { /* user cancelled */ }
    }

    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(text + "\n" + url);
    alert("Copied to clipboard! Share it anywhere.");
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      `I saved ₹${savedAmount.toLocaleString("en-IN")} on ${loots} purchases using Loot 🎯\n\nNot just a deal. A loot.\n\nloot-eta.vercel.app`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  function shareTwitter() {
    const text = encodeURIComponent(
      `I saved ₹${savedAmount.toLocaleString("en-IN")} using @LootIndia on ${loots} purchases this year. 🎯\n\nNot just a deal. A loot.\n\nloot-eta.vercel.app`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  }

  function shareLinkedIn() {
    const url = encodeURIComponent("https://loot-eta.vercel.app");
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2">Your Loot Report</h1>
        <p className="text-zinc-500 text-sm">Your smart shopping year in numbers. Share it.</p>
      </div>

      {/* Card + share */}
      <div className="flex flex-col items-center gap-8">
        <div ref={cardRef}>
          <SavingsCard
            name={name}
            persona={persona}
            loots={loots}
            savedAmount={savedAmount}
            bestLoot={bestLoot}
            year={year}
          />
        </div>

        {/* Share buttons */}
        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={share}
            className="w-full bg-amber-400 hover:bg-amber-300 text-black font-black rounded-2xl py-4 text-sm transition-colors"
          >
            Share my Loot Report →
          </button>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={shareWhatsApp}
              className="flex flex-col items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <span className="text-xl">💬</span>
              <span className="text-zinc-400 text-xs">WhatsApp</span>
            </button>
            <button
              onClick={shareTwitter}
              className="flex flex-col items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <span className="text-xl">𝕏</span>
              <span className="text-zinc-400 text-xs">Twitter/X</span>
            </button>
            <button
              onClick={shareLinkedIn}
              className="flex flex-col items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <span className="text-xl">💼</span>
              <span className="text-zinc-400 text-xs">LinkedIn</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats below card */}
      <div className="mt-12 grid grid-cols-3 gap-4 text-center">
        {[
          { label: "Loots this year", value: loots },
          { label: "Avg saved/loot", value: `₹${savedPerLoot.toLocaleString("en-IN")}` },
          { label: "vs market avg", value: `-${Math.floor((savedAmount / (savedAmount + loots * 3000)) * 100)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <div className="text-white font-black text-xl mb-1">{value}</div>
            <div className="text-zinc-600 text-xs">{label}</div>
          </div>
        ))}
      </div>

      {/* CTA to research */}
      <div className="mt-8 bg-amber-400/5 border border-amber-400/15 rounded-2xl p-6 text-center">
        <div className="text-amber-400 font-black text-lg mb-2">Your next loot is waiting.</div>
        <p className="text-zinc-500 text-sm mb-4">
          Every search on Loot is one fewer tab, one fewer regret.
        </p>
        <button
          onClick={() => router.push("/app/research")}
          className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-6 py-3 text-sm transition-colors"
        >
          Find your next deal →
        </button>
      </div>
    </div>
  );
}
