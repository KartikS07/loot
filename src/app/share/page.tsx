import type { Metadata } from "next";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ savings?: string; loots?: string; name?: string; persona?: string; best?: string }>;
}

const PERSONA_LABELS: Record<string, string> = {
  value_hunter: "Value Hunter 🎯",
  quality_seeker: "Quality Seeker 💎",
  brand_loyalist: "Brand Loyalist 🏆",
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { savings, loots, name, persona } = await searchParams;
  const savingsNum = parseInt(savings ?? "0") || 0;
  const savingsFormatted = `₹${savingsNum.toLocaleString("en-IN")}`;
  const displayName = name ? `${name}'s` : "My";
  const personaLabel = PERSONA_LABELS[persona ?? ""] ?? "Smart Shopper";

  const title = `${displayName} Loot Report — ${savingsFormatted} in deals found`;
  const description = `${displayName} Loot Report: ${savingsFormatted} in deals across ${loots ?? "0"} products. ${personaLabel}. Not just a deal. A loot.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: "https://loot-eta.vercel.app/share",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SharePage({ searchParams }: Props) {
  const { savings, loots, name, persona, best } = await searchParams;
  const savingsNum = parseInt(savings ?? "0") || 0;
  const lootsNum = parseInt(loots ?? "0") || 0;
  const savingsFormatted = `₹${savingsNum.toLocaleString("en-IN")}`;
  const displayName = name ? `${name}'s` : "My";
  const personaLabel = PERSONA_LABELS[persona ?? ""] ?? "Smart Shopper 🛍️";

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Shared card preview */}
        <div className="bg-[#0a0a0a] border border-zinc-800 rounded-3xl p-8 text-left">
          <div className="flex items-center justify-between mb-6">
            <span className="text-amber-400 font-black text-xl">Loot</span>
            <span className="text-zinc-600 text-xs">2026 Report</span>
          </div>

          <div className="mb-2 text-zinc-600 text-xs uppercase tracking-widest">
            {displayName} Shopping Year
          </div>
          <div className="text-white font-semibold text-sm mb-6">{personaLabel}</div>

          <div className="mb-6">
            <div className="text-zinc-600 text-xs uppercase tracking-widest mb-2">Deals found</div>
            <div className="text-white font-black text-5xl">{savingsFormatted}</div>
            <div className="text-zinc-500 text-xs mt-1">vs listed price</div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-900">
            <div>
              <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Loots</div>
              <div className="text-white font-black text-2xl">{lootsNum}</div>
            </div>
            {best && (
              <div>
                <div className="text-zinc-600 text-xs uppercase tracking-widest mb-1">Best loot</div>
                <div className="text-amber-400 font-bold text-sm">{decodeURIComponent(best)}</div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div>
          <h2 className="text-2xl font-black mb-3">What&apos;s your Loot Report?</h2>
          <p className="text-zinc-500 text-sm mb-6">
            Find deals across 11 Indian platforms. Apply your bank card discounts. Know exactly when and where to buy.
          </p>
          <Link
            href="/app"
            className="inline-block bg-amber-400 hover:bg-amber-300 text-black font-black rounded-2xl px-8 py-4 text-base transition-colors"
          >
            Get your Loot Report — free →
          </Link>
          <p className="text-zinc-700 text-xs mt-3">No credit card. Free for early users.</p>
        </div>
      </div>
    </div>
  );
}
