"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Types ──
interface Deal {
  id: string;
  productName: string;
  platform: string;
  bestPrice: number;
  marketHighPrice: number;
  savedVsHighest: number;
  confirmedPurchase: boolean;
  createdAt: number;
}

interface SavingsData {
  dealsCount: number;
  totalDealsFound: number;
  confirmedCount: number;
  bestDeal: { productName: string; saved: number } | null;
  recent: Deal[];
}

// ── Profile ──
function getProfile() {
  if (typeof window === "undefined") return {} as Record<string, string>;
  try { return JSON.parse(localStorage.getItem("loot_profile") ?? "{}"); }
  catch { return {}; }
}

function loadDealsFromStorage(): Deal[] {
  try {
    return JSON.parse(localStorage.getItem("loot_pending_deals") ?? "[]");
  } catch { return []; }
}

function saveDealsToStorage(deals: Deal[]) {
  localStorage.setItem("loot_pending_deals", JSON.stringify(deals));
}

// ── Persona config ──
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

// ── Savings card (the shareable artifact) ──
interface CardProps {
  name: string;
  persona: string;
  dealsCount: number;
  totalFound: number;
  confirmedCount: number;
  bestDeal: string;
}

function LootReportCard({ name, persona, dealsCount, totalFound, confirmedCount, bestDeal }: CardProps) {
  return (
    <div
      id="loot-report-card"
      className="w-80 bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-6 shadow-2xl shadow-amber-400/5 select-none"
    >
      <div className="flex items-center justify-between mb-6">
        <span className="text-amber-400 font-black text-xl tracking-tight">Loot</span>
        <span className="text-zinc-600 text-xs font-medium">2026 Report</span>
      </div>

      <div className="mb-6">
        <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1">
          {name ? `${name}'s` : "My"} Shopping Year
        </div>
        <div className="text-white text-sm font-semibold">
          {PERSONA_LABELS[persona] ?? "Smart Shopper 🛍️"}
        </div>
      </div>

      <div className="mb-5">
        <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Deals found</div>
        <div className="text-white font-black text-5xl leading-none">
          ₹{totalFound.toLocaleString("en-IN")}
        </div>
        <div className="text-zinc-500 text-xs mt-1">
          {confirmedCount > 0
            ? `${confirmedCount} purchase${confirmedCount > 1 ? "s" : ""} confirmed`
            : "vs highest alternative price"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-900 mb-4">
        <div>
          <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Loots</div>
          <div className="text-white font-black text-2xl">{dealsCount}</div>
        </div>
        <div>
          <div className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1">Best loot</div>
          <div className="text-amber-400 font-bold text-sm leading-tight">{bestDeal}</div>
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-900">
        <div className="text-zinc-500 text-xs leading-relaxed italic">
          &ldquo;{PERSONA_TAGLINES[persona] ?? "Shop smarter. Save more."}&rdquo;
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-900">
        <span className="text-zinc-700 text-[10px]">loot-eta.vercel.app</span>
        <span className="text-zinc-700 text-[10px]">Not just a deal. A loot.</span>
      </div>
    </div>
  );
}

// ── "Did you buy it?" nudge card ──
function BuyNudge({ deal, onYes, onNo }: { deal: Deal; onYes: () => void; onNo: () => void }) {
  return (
    <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="text-white text-sm font-semibold truncate">{deal.productName}</div>
        <div className="text-zinc-500 text-xs mt-0.5">
          Best deal on {deal.platform} · {new Date(deal.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <span className="text-zinc-600 text-xs">Did you buy it?</span>
        <button
          onClick={onYes}
          className="bg-green-400/15 hover:bg-green-400/25 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          Yes ✓
        </button>
        <button
          onClick={onNo}
          className="bg-zinc-900 hover:bg-zinc-800 text-zinc-500 text-xs px-3 py-1.5 rounded-lg transition-colors"
        >
          Nope
        </button>
      </div>
    </div>
  );
}

// ── Main page ──
export default function SavingsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [deals, setDeals] = useState<Deal[]>([]);
  const [savings, setSavings] = useState<SavingsData>({
    dealsCount: 0, totalDealsFound: 0, confirmedCount: 0, bestDeal: null, recent: [],
  });

  useEffect(() => {
    const p = getProfile();
    setProfile(p);
    const stored = loadDealsFromStorage();
    setDeals(stored);

    // Compute savings from localStorage deals
    const total = stored.reduce((s, d) => s + d.savedVsHighest, 0);
    const confirmed = stored.filter(d => d.confirmedPurchase);
    const best = [...stored].sort((a, b) => b.savedVsHighest - a.savedVsHighest)[0];
    setSavings({
      dealsCount: stored.length,
      totalDealsFound: total,
      confirmedCount: confirmed.length,
      bestDeal: best ? { productName: best.productName, saved: best.savedVsHighest } : null,
      recent: stored.slice(0, 10),
    });
    setMounted(true);
  }, []);

  function handleConfirm(dealId: string) {
    const updated = deals.map(d => d.id === dealId ? { ...d, confirmedPurchase: true } : d);
    setDeals(updated);
    saveDealsToStorage(updated);

    // Recalculate
    const total = updated.reduce((s, d) => s + d.savedVsHighest, 0);
    const confirmed = updated.filter(d => d.confirmedPurchase);
    setSavings(prev => ({ ...prev, totalDealsFound: total, confirmedCount: confirmed.length }));

    // Persist to Convex
    const deal = deals.find(d => d.id === dealId);
    if (deal) {
      fetch("/api/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: dealId }),
      }).catch(() => {});
    }
  }

  function handleDismiss(dealId: string) {
    const updated = deals.map(d => d.id === dealId ? { ...d, confirmedPurchase: false, dismissed: true } : d);
    // Mark as dismissed so we don't show the nudge again
    const withDismissed = deals.map(d =>
      d.id === dealId ? { ...d, _dismissed: true } : d
    );
    setDeals(withDismissed);
    saveDealsToStorage(withDismissed);
  }

  const name = profile.name ?? "";
  const persona = profile.persona ?? "value_hunter";
  const pendingNudges = (deals as (Deal & { _dismissed?: boolean })[])
    .filter(d => !d.confirmedPurchase && !d._dismissed)
    .slice(0, 3);

  async function share() {
    const text = `I found ₹${savings.totalDealsFound.toLocaleString("en-IN")} in deals using Loot 🎯\n\nNot just a deal. A loot.\n\nloot-eta.vercel.app`;
    if (navigator.share) {
      try { await navigator.share({ title: "My Loot Report", text, url: "https://loot-eta.vercel.app" }); return; }
      catch { /* user cancelled */ }
    }
    await navigator.clipboard.writeText(text).catch(() => {});
    alert("Copied! Share it anywhere.");
  }

  const shareText = (suffix: string) =>
    encodeURIComponent(`I found ₹${savings.totalDealsFound.toLocaleString("en-IN")} in deals using Loot 🎯${suffix}\n\nloot-eta.vercel.app`);

  if (!mounted) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state — user hasn't used the price optimizer yet
  if (savings.dealsCount === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-5xl mb-6">🎯</div>
        <h1 className="text-2xl font-black mb-3">Your Loot Report is empty</h1>
        <p className="text-zinc-500 mb-8 max-w-md mx-auto">
          Use the Price Optimizer on any product and click &ldquo;Buy on Platform&rdquo; —
          Loot will automatically track the deals you found.
        </p>
        <button
          onClick={() => router.push("/app/research")}
          className="bg-amber-400 hover:bg-amber-300 text-black font-bold rounded-xl px-8 py-3 text-sm transition-colors"
        >
          Find your first deal →
        </button>
      </div>
    );
  }

  const bestDealLabel = savings.bestDeal
    ? `₹${savings.bestDeal.saved.toLocaleString("en-IN")} on ${savings.bestDeal.productName.split(" ").slice(0, 3).join(" ")}`
    : "—";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black mb-2">Your Loot Report</h1>
        <p className="text-zinc-500 text-sm">Every deal Loot found for you. Share it.</p>
      </div>

      {/* "Did you buy it?" nudges — shown only for recent unconfirmed deals */}
      {pendingNudges.length > 0 && (
        <div className="mb-8 space-y-3">
          <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-3">
            Confirm your purchases
          </div>
          {pendingNudges.map(deal => (
            <BuyNudge
              key={deal.id}
              deal={deal}
              onYes={() => handleConfirm(deal.id)}
              onNo={() => handleDismiss(deal.id)}
            />
          ))}
        </div>
      )}

      {/* Loot Report Card + share */}
      <div className="flex flex-col items-center gap-8 mb-12">
        <LootReportCard
          name={name}
          persona={persona}
          dealsCount={savings.dealsCount}
          totalFound={savings.totalDealsFound}
          confirmedCount={savings.confirmedCount}
          bestDeal={bestDealLabel}
        />

        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={share}
            className="w-full bg-amber-400 hover:bg-amber-300 text-black font-black rounded-2xl py-4 text-sm transition-colors"
          >
            Share my Loot Report →
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => window.open(`https://wa.me/?text=${shareText("\n\nI never overpay anymore.")}`, "_blank")}
              className="flex flex-col items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <span className="text-xl">💬</span>
              <span className="text-zinc-400 text-xs">WhatsApp</span>
            </button>
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${shareText("")}`, "_blank")}
              className="flex flex-col items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <span className="text-xl">𝕏</span>
              <span className="text-zinc-400 text-xs">Twitter/X</span>
            </button>
            <button
              onClick={() => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://loot-eta.vercel.app")}`, "_blank")}
              className="flex flex-col items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <span className="text-xl">💼</span>
              <span className="text-zinc-400 text-xs">LinkedIn</span>
            </button>
          </div>
        </div>
      </div>

      {/* Deal history */}
      {savings.recent.length > 0 && (
        <div className="mb-8">
          <div className="text-xs font-semibold text-zinc-600 uppercase tracking-widest mb-4">Deal history</div>
          <div className="space-y-2">
            {savings.recent.map((deal, i) => (
              <div key={i} className="flex items-center justify-between bg-zinc-950 border border-zinc-900 rounded-xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-white text-sm font-medium truncate">{deal.productName}</div>
                  <div className="text-zinc-600 text-xs">{deal.platform}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="text-amber-400 font-bold text-sm">
                    ₹{deal.savedVsHighest.toLocaleString("en-IN")} found
                  </div>
                  {deal.confirmedPurchase && (
                    <div className="text-green-400 text-[10px]">✓ purchased</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="bg-amber-400/5 border border-amber-400/15 rounded-2xl p-6 text-center">
        <div className="text-amber-400 font-black text-lg mb-2">Your next loot is waiting.</div>
        <p className="text-zinc-500 text-sm mb-4">Every search on Loot is one fewer tab, one fewer regret.</p>
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
