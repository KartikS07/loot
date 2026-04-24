"use client";

import { useRef, useState, useEffect, useCallback } from "react";
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
  const [sharing, setSharing] = useState(false);
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

  // URL is appended separately — never include it in the text body
  // to prevent WhatsApp showing it twice (once in text, once as hyperlink)
  const buildShareText = useCallback((suffix = "") =>
    `I found ₹${savings.totalDealsFound.toLocaleString("en-IN")} in deals using Loot 🎯${suffix}\n\nNot just a deal. A loot.`,
  [savings.totalDealsFound]);

  // Build a personalized share URL that generates a custom OG image with user's data
  // e.g. loot-eta.vercel.app/share?savings=7249&loots=2&name=Kartik&persona=value_hunter
  const buildPersonalizedUrl = useCallback(() => {
    const base = "https://loot-eta.vercel.app/share";
    const params = new URLSearchParams();
    if (savings.totalDealsFound) params.set("savings", String(savings.totalDealsFound));
    if (savings.dealsCount) params.set("loots", String(savings.dealsCount));
    if (name) params.set("name", name);
    if (persona) params.set("persona", persona);
    if (savings.bestDeal) params.set("best", `₹${savings.bestDeal.saved.toLocaleString("en-IN")} on ${savings.bestDeal.productName.split(" ").slice(0, 3).join(" ")}`);
    return `${base}?${params.toString()}`;
  }, [savings, name, persona]);

  const shareText = (suffix: string) => encodeURIComponent(buildShareText(suffix));

  const [toastMsg, setToastMsg] = useState("");
  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }

  // Download the Loot Report card as a PNG image (desktop use case)
  const downloadCard = useCallback(async () => {
    setSharing(true);
    try {
      const cardEl = document.getElementById("loot-report-card");
      if (!cardEl) throw new Error("Card not found");
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardEl, { backgroundColor: "#0a0a0a", scale: 2, useCORS: true, logging: false });
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png", 0.95));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "loot-report.png";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Card downloaded! Attach it when sharing.");
    } catch { showToast("Couldn't capture card. Try a screenshot."); }
    finally { setSharing(false); }
  }, []);

  // Share: WhatsApp and X use text + URL — WhatsApp reads og:image from loot-eta.vercel.app
  // and shows it as a rich link preview (same as how KukuFM, Spotify etc. work).
  // No file attachment needed — the OG image IS the visual.
  const captureAndShare = useCallback(async (platform?: "whatsapp" | "x" | "linkedin") => {
    const siteUrl = "https://loot-eta.vercel.app";
    const text = buildShareText("\n\nI never overpay anymore.");

    if (platform === "x") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
      return;
    }
    if (platform === "linkedin") {
      const shareUrl = buildPersonalizedUrl();
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank");
      return;
    }
    if (platform === "whatsapp") {
      // Build personalized share URL — WhatsApp fetches its og:image which shows
      // the user's actual Loot Report card (their savings, name, persona)
      const shareUrl = buildPersonalizedUrl();
      const waText = `${text}\n\n${shareUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(waText)}`, "_blank");
      return;
    }

    // Main "Share my Loot Report" button — try native share sheet first (mobile)
    setSharing(true);
    try {
      const shareUrl = buildPersonalizedUrl();
      if (navigator.share) {
        await navigator.share({ title: "My Loot Report", text, url: shareUrl });
        return;
      }
      // Desktop fallback: copy link + offer download
      await navigator.clipboard.writeText(`${text}\n\n${siteUrl}`);
      showToast("Link copied! Paste it in WhatsApp or anywhere.");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") showToast("Link copied to clipboard.");
    } finally {
      setSharing(false);
    }
  }, [buildShareText]);

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
          {/* Non-blocking toast */}
          {toastMsg && (
            <div className="text-center bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-300 text-xs animate-pulse">
              {toastMsg}
            </div>
          )}
          <button
            onClick={() => captureAndShare()}
            disabled={sharing}
            className="w-full bg-amber-400 hover:bg-amber-300 text-black font-black rounded-2xl py-4 text-sm transition-colors disabled:opacity-60"
          >
            {sharing ? "Opening share sheet..." : "Share my Loot Report →"}
          </button>
          <div className="grid grid-cols-3 gap-2">
            {/* WhatsApp — shares card image via Web Share API on mobile */}
            <button
              onClick={() => captureAndShare("whatsapp")}
              disabled={sharing}
              className="flex flex-col items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.36 5.07L2 22l5.09-1.33A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.21-.47-4.53-1.28l-.32-.19-3.02.79.8-2.94-.21-.33A7.96 7.96 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" fill="#25D366"/>
              </svg>
              <span className="text-zinc-400 text-xs">WhatsApp</span>
            </button>
            {/* X */}
            <button
              onClick={() => captureAndShare("x")}
              disabled={sharing}
              className="flex flex-col items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="text-zinc-400 text-xs">X</span>
            </button>
            {/* LinkedIn */}
            <button
              onClick={() => captureAndShare("linkedin")}
              disabled={sharing}
              className="flex flex-col items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl py-3 transition-colors"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className="text-zinc-400 text-xs">LinkedIn</span>
            </button>
          </div>
          {/* Download card as image — for attaching manually to X or desktop sharing */}
          <button
            onClick={downloadCard}
            disabled={sharing}
            className="w-full text-xs text-zinc-600 hover:text-zinc-400 transition-colors py-1"
          >
            {sharing ? "Capturing..." : "↓ Download card as image"}
          </button>
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
