"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RazorpayCheckoutButton } from "@/components/RazorpayCheckoutButton";
import { track } from "@/lib/analytics";

// ── Tip Jar config ──
const TIP_AMOUNTS: { label: string; paise: number }[] = [
  { label: "₹49", paise: 4900 },
  { label: "₹99", paise: 9900 },
  { label: "₹199", paise: 19900 },
];
const SUPPORT_EMAIL = "support@loot.app";

type TipFailure = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
};

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
    const raw = JSON.parse(localStorage.getItem("loot_pending_deals") ?? "[]");
    if (!Array.isArray(raw)) return [];
    // Coerce numeric fields — older logDeal versions sometimes wrote null/undefined,
    // which crashed the page on .toLocaleString().
    return raw
      .filter((d) => d && typeof d.id === "string" && typeof d.productName === "string")
      .map((d): Deal => ({
        id: d.id,
        productName: d.productName,
        platform: typeof d.platform === "string" ? d.platform : "",
        bestPrice: Number.isFinite(d.bestPrice) ? Number(d.bestPrice) : 0,
        marketHighPrice: Number.isFinite(d.marketHighPrice) ? Number(d.marketHighPrice) : 0,
        savedVsHighest: Number.isFinite(d.savedVsHighest) ? Number(d.savedVsHighest) : 0,
        confirmedPurchase: Boolean(d.confirmedPurchase),
        createdAt: Number.isFinite(d.createdAt) ? Number(d.createdAt) : Date.now(),
      }));
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

// Tier ladder makes the artifact feel like a Spotify Wrapped / GitHub Year-in-Review:
// users compare their level to their friends' and want to climb.
function looterTier(dealsCount: number): { title: string; sub: string } {
  if (dealsCount >= 25) return { title: "Loot Legend", sub: "Top 1% of shoppers" };
  if (dealsCount >= 10) return { title: "Master Looter", sub: "You don't pay full price" };
  if (dealsCount >= 5)  return { title: "Pro Looter",   sub: "Caught the bug" };
  if (dealsCount >= 1)  return { title: "Looter",        sub: "First raid done" };
  return { title: "Just getting started", sub: "Your first loot is coming" };
}

function LootReportCard({ name, persona, dealsCount, totalFound, confirmedCount, bestDeal }: CardProps) {
  const tier = looterTier(dealsCount);
  const personaLabel = PERSONA_LABELS[persona] ?? "Smart Shopper 🛍️";
  const tagline = PERSONA_TAGLINES[persona] ?? "Shop smarter. Save more.";

  return (
    <div
      id="loot-report-card"
      className="relative w-[360px] overflow-hidden rounded-3xl select-none"
      style={{
        background:
          "radial-gradient(1200px 200px at 50% -20%, rgba(245, 158, 11, 0.18), transparent 60%), linear-gradient(180deg, #0d0a05 0%, #050505 100%)",
        boxShadow:
          "0 30px 60px -20px rgba(245, 158, 11, 0.15), 0 0 0 1px rgba(245, 158, 11, 0.18)",
      }}
    >
      {/* Subtle inner glow for depth on screenshot */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          background:
            "radial-gradient(800px 100px at 50% 110%, rgba(245, 158, 11, 0.07), transparent 60%)",
        }}
      />

      <div className="relative p-7">
        {/* Header: brand + year */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-baseline gap-2">
            <span className="text-amber-400 font-black text-2xl tracking-tight leading-none">Loot</span>
            <span className="text-amber-400/40 text-[11px] font-semibold tracking-[0.2em] uppercase">Report</span>
          </div>
          <span className="text-zinc-500 text-[10px] font-semibold tracking-[0.2em] uppercase">2026</span>
        </div>

        {/* Persona chip */}
        <div className="mb-5">
          <div className="text-zinc-600 text-[10px] uppercase tracking-[0.2em] mb-2">
            {name ? `${name}'s` : "My"} year
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/12 border border-amber-400/30 text-amber-300 text-[12px] font-semibold">
            {personaLabel}
          </span>
        </div>

        {/* Hero: Deals found */}
        <div className="mb-6">
          <div className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] mb-2">Deals found</div>
          <div
            className="font-black text-[64px] leading-[0.9] tracking-tight"
            style={{
              background: "linear-gradient(180deg, #ffffff 0%, #fbbf24 130%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            ₹{(totalFound ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="text-zinc-500 text-xs mt-1.5">
            {confirmedCount > 0
              ? `${confirmedCount} purchase${confirmedCount > 1 ? "s" : ""} confirmed`
              : totalFound > 0
                ? "in bank offers & discounts found"
                : "use price optimizer to start tracking"}
          </div>
        </div>

        {/* Tier ladder + stats */}
        <div className="flex items-stretch gap-3 mb-6">
          <div className="flex-1 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3">
            <div className="text-amber-400/70 text-[9px] uppercase tracking-[0.2em] mb-1">Tier</div>
            <div className="text-amber-300 font-black text-sm leading-tight">{tier.title}</div>
            <div className="text-amber-400/50 text-[10px] mt-0.5 leading-tight">{tier.sub}</div>
          </div>
          <div className="w-[88px] rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3">
            <div className="text-zinc-600 text-[9px] uppercase tracking-[0.2em] mb-1">Loots</div>
            <div className="text-white font-black text-2xl leading-none">{dealsCount}</div>
          </div>
        </div>

        {/* Best loot */}
        {bestDeal && bestDeal !== "—" && (
          <div className="mb-6 rounded-2xl border border-zinc-800/70 bg-zinc-950/60 p-3">
            <div className="text-zinc-600 text-[9px] uppercase tracking-[0.2em] mb-1">Best loot</div>
            <div className="text-amber-400 font-bold text-sm leading-tight">{bestDeal}</div>
          </div>
        )}

        {/* Tagline */}
        <div className="text-zinc-400 text-xs leading-relaxed italic mb-5">
          &ldquo;{tagline}&rdquo;
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-900 pt-4">
          <span className="text-zinc-600 text-[10px] font-medium">loot-eta.vercel.app</span>
          <span className="text-amber-400/60 text-[10px] font-semibold tracking-wide">Not just a deal. A loot.</span>
        </div>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage hydration on mount
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
  // to prevent WhatsApp showing it twice (once in text, once as hyperlink).
  // Emoji-free body: 4-byte surrogate-pair emojis (e.g. 🎯) get mangled to a
  // replacement character on WhatsApp Desktop when passed via wa.me/?text=.
  // The OG image carries the visual punch — we don't need an emoji here.
  const buildShareText = useCallback((suffix = "") =>
    `I found ₹${(savings.totalDealsFound ?? 0).toLocaleString("en-IN")} in deals using Loot.${suffix}\n\nNot just a deal. A loot.`,
  [savings.totalDealsFound]);

  // Build a personalized share URL that generates a custom OG image with user's data
  // e.g. loot-eta.vercel.app/share?savings=7249&loots=2&name=Kartik&persona=value_hunter
  // Adds a `t=` cache-buster so WhatsApp/X/LinkedIn crawlers fetch the latest OG image
  // instead of serving a stale preview from a previous share of the same URL.
  const buildPersonalizedUrl = useCallback(() => {
    const base = "https://loot-eta.vercel.app/share";
    const params = new URLSearchParams();
    if (savings.totalDealsFound) params.set("savings", String(savings.totalDealsFound));
    if (savings.dealsCount) params.set("loots", String(savings.dealsCount));
    if (name) params.set("name", name);
    if (persona) params.set("persona", persona);
    if (savings.bestDeal) params.set("best", `₹${(savings.bestDeal.saved ?? 0).toLocaleString("en-IN")} on ${savings.bestDeal.productName.split(" ").slice(0, 3).join(" ")}`);
    params.set("t", String(Date.now()));
    return `${base}?${params.toString()}`;
  }, [savings, name, persona]);

  const shareText = (suffix: string) => encodeURIComponent(buildShareText(suffix));

  const [toastMsg, setToastMsg] = useState("");
  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }

  // Tip Jar: preserve order+payment IDs on verify-failed so user can email support.
  const [tipRecoveryIds, setTipRecoveryIds] = useState<TipFailure | null>(null);
  const userEmail = profile.email ?? "";

  // Download the Loot Report card as a PNG. We use html-to-image instead of html2canvas
  // because Tailwind v4 emits oklch() colors that html2canvas can't parse — every render
  // failed with a CSS parse error.
  const downloadCard = useCallback(async () => {
    setSharing(true);
    try {
      const cardEl = document.getElementById("loot-report-card");
      if (!cardEl) throw new Error("Card not found");
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardEl, {
        backgroundColor: "#0a0a0a",
        pixelRatio: 2,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "loot-report.png";
      a.click();
      showToast("Card downloaded! Attach it when sharing.");
    } catch (e) {
      console.error("[savings] downloadCard failed:", e);
      showToast("Couldn't capture card. Try a screenshot.");
    }
    finally { setSharing(false); }
  }, []);

  // Share: WhatsApp and X use text + URL — WhatsApp reads og:image from loot-eta.vercel.app
  // and shows it as a rich link preview (same as how KukuFM, Spotify etc. work).
  // No file attachment needed — the OG image IS the visual.
  const captureAndShare = useCallback(async (platform?: "whatsapp" | "x" | "linkedin") => {
    const siteUrl = "https://loot-eta.vercel.app";
    const text = buildShareText("\n\nI never overpay anymore.");

    track("share_click", {
      channel: platform ?? "native",
      savings: savings.totalDealsFound,
      dealsCount: savings.dealsCount,
    });

    if (platform === "x") {
      // X supports ?text= for the message AND ?url= as a separate card (not in char count)
      // X will show the og:image from the /share URL as a card preview
      const shareUrl = buildPersonalizedUrl();
      const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(xUrl, "_blank");
      return;
    }
    if (platform === "linkedin") {
      // LinkedIn's API constraints:
      //  - share-offsite/?url=… renders the OG card correctly but cannot pre-fill text.
      //  - feed/?shareActive=true&text=… can pre-fill text but strips query params off
      //    any URL inside the body (so the OG card collapses to bare /share with ₹0).
      // We optimise for the OG card (the visual hook) and ask the user to paste the
      // copied message. Two-step UX: copy → confirm via window.confirm so the user
      // is unambiguously aware their clipboard is loaded before LinkedIn opens.
      const shareUrl = buildPersonalizedUrl();
      const linkedInText = `${text}\n\n${shareUrl}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(linkedInText);
        copied = true;
      } catch {
        copied = false;
      }
      const proceed = window.confirm(
        copied
          ? "Your Loot Report message is copied.\n\nLinkedIn will open next — paste the message above the preview card with Cmd+V (or Ctrl+V).\n\nClick OK to continue."
          : "Couldn't copy automatically. Click OK to open LinkedIn, then paste this manually:\n\n" + linkedInText
      );
      if (!proceed) return;
      window.open(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
        "_blank"
      );
      showToast(copied ? "Message ready — paste with Cmd+V on LinkedIn." : "Open LinkedIn and paste your message.");
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
    ? `₹${(savings.bestDeal.saved ?? 0).toLocaleString("en-IN")} on ${savings.bestDeal.productName.split(" ").slice(0, 3).join(" ")}`
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

      {/* Tip Jar — say thanks, no unlock */}
      <div className="mb-12 bg-zinc-950 border border-zinc-900 rounded-2xl px-6 py-5">
        <div className="text-white text-sm font-semibold mb-1">
          If Loot saved you money, tip the builder?
        </div>
        <div className="text-zinc-500 text-xs mb-4">
          No unlocks. Just gratitude — keeps the lights on.
        </div>

        {userEmail ? (
          <div className="grid grid-cols-3 gap-2">
            {TIP_AMOUNTS.map((t) => (
              <RazorpayCheckoutButton
                key={t.paise}
                kind="tip"
                email={userEmail}
                name={profile.name}
                amountPaise={t.paise}
                label={t.label}
                notes="savings-page-tip"
                className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-400/40 text-white text-sm font-semibold rounded-full px-5 py-2 transition-colors disabled:opacity-60"
                onSuccess={() => {
                  console.log("[tip] success", { amountPaise: t.paise });
                  setTipRecoveryIds(null);
                }}
                onFailure={(reason, paymentIds) => {
                  if (reason === "verify-failed" && paymentIds) {
                    setTipRecoveryIds(paymentIds);
                  }
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-zinc-600 text-xs italic">
            Complete onboarding to tip
          </div>
        )}

        {tipRecoveryIds && (
          <div
            role="alert"
            className="mt-4 bg-red-500/5 border border-red-500/30 rounded-xl p-4 text-xs relative"
          >
            <button
              type="button"
              onClick={() => setTipRecoveryIds(null)}
              aria-label="Dismiss recovery banner"
              className="absolute top-2 right-2 w-6 h-6 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 flex items-center justify-center text-sm"
            >
              ×
            </button>
            <div className="text-red-400 font-semibold mb-2 pr-8">
              Payment received but verification failed.
            </div>
            <div className="text-zinc-400 mb-1">
              You were charged. Save these IDs and email us — we&rsquo;ll sort it out.
            </div>
            <div className="font-mono text-zinc-300 break-all mb-1">
              Order: {tipRecoveryIds.razorpay_order_id}
            </div>
            <div className="font-mono text-zinc-300 break-all mb-3">
              Payment: {tipRecoveryIds.razorpay_payment_id}
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                "Loot tip verification failed"
              )}&body=${encodeURIComponent(
                `Order ID: ${tipRecoveryIds.razorpay_order_id}\nPayment ID: ${tipRecoveryIds.razorpay_payment_id}\nEmail: ${userEmail}\n\n(please keep these IDs in your reply)`
              )}`}
              className="inline-block text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2"
            >
              Email {SUPPORT_EMAIL} →
            </a>
          </div>
        )}
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
                  <div className={`font-bold text-sm ${(deal.savedVsHighest ?? 0) > 0 ? "text-amber-400" : "text-zinc-500"}`}>
                    {(deal.savedVsHighest ?? 0) > 0
                      ? `₹${(deal.savedVsHighest ?? 0).toLocaleString("en-IN")} found`
                      : "Tracked · time saved"}
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
