import { ImageResponse } from "next/og";

export const alt = "My Loot Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Served per-request so searchParams resolve correctly; avoids prerender crash when params are absent.
export const dynamic = "force-dynamic";

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

function looterTier(dealsCount: number): { title: string; sub: string } {
  if (dealsCount >= 25) return { title: "Loot Legend", sub: "Top 1% of shoppers" };
  if (dealsCount >= 10) return { title: "Master Looter", sub: "You don't pay full price" };
  if (dealsCount >= 5)  return { title: "Pro Looter",   sub: "Caught the bug" };
  if (dealsCount >= 1)  return { title: "Looter",        sub: "First raid done" };
  return { title: "Just getting started", sub: "Your first loot is coming" };
}

type OgParams = { savings?: string; loots?: string; name?: string; persona?: string; best?: string };

export default async function OGImage(
  props?: { searchParams?: Promise<OgParams> | OgParams }
) {
  let params: OgParams = {};
  try {
    const raw = props?.searchParams;
    if (raw && typeof (raw as Promise<OgParams>).then === "function") {
      params = (await (raw as Promise<OgParams>)) ?? {};
    } else if (raw) {
      params = raw as OgParams;
    }
  } catch {
    params = {};
  }

  const savings = parseInt(params.savings ?? "0") || 0;
  const loots = parseInt(params.loots ?? "0") || 0;
  const name = params.name ?? "";
  const persona = params.persona ?? "value_hunter";
  const best = params.best ?? "";

  const formattedSavings = `₹${savings.toLocaleString("en-IN")}`;
  const personaLabel = PERSONA_LABELS[persona] ?? "Smart Shopper 🛍️";
  const tagline = PERSONA_TAGLINES[persona] ?? "Shop smarter. Save more.";
  const tier = looterTier(loots);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "40px",
          gap: "56px",
          background:
            "radial-gradient(900px 500px at 25% 30%, rgba(245, 158, 11, 0.18), transparent 60%), linear-gradient(180deg, #0d0a05 0%, #050505 100%)",
        }}
      >
        {/* Left: Loot Report Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            width: "470px",
            padding: "44px",
            borderRadius: "28px",
            background: "linear-gradient(180deg, #0d0a05 0%, #050505 100%)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            boxShadow: "0 30px 60px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span style={{ color: "#F59E0B", fontSize: "30px", fontWeight: 900 }}>Loot</span>
              <span style={{ color: "rgba(245, 158, 11, 0.5)", fontSize: "12px", fontWeight: 700, letterSpacing: "3px" }}>REPORT</span>
            </div>
            <span style={{ color: "#71717a", fontSize: "12px", fontWeight: 700, letterSpacing: "3px" }}>2026</span>
          </div>

          {/* Year + persona chip */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "26px" }}>
            <div style={{ display: "flex", color: "#52525b", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", marginBottom: "10px" }}>
              {(name ? `${name}'s` : "MY").toUpperCase()} YEAR
            </div>
            <div style={{ display: "flex", alignSelf: "flex-start", padding: "6px 14px", borderRadius: "999px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.35)" }}>
              <span style={{ color: "#fcd34d", fontSize: "14px", fontWeight: 700 }}>{personaLabel}</span>
            </div>
          </div>

          {/* Hero ₹ amount */}
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "26px" }}>
            <div style={{ display: "flex", color: "#52525b", fontSize: "11px", fontWeight: 700, letterSpacing: "3px", marginBottom: "8px" }}>
              DEALS FOUND
            </div>
            <div style={{ display: "flex", color: "#fbbf24", fontSize: savings >= 100000 ? "76px" : savings >= 10000 ? "84px" : "92px", fontWeight: 900, lineHeight: 0.95, letterSpacing: "-2px" }}>
              {formattedSavings}
            </div>
          </div>

          {/* Tier + Loots */}
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "14px 16px", borderRadius: "16px", background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
              <div style={{ display: "flex", color: "rgba(245, 158, 11, 0.7)", fontSize: "9px", fontWeight: 700, letterSpacing: "3px", marginBottom: "6px" }}>TIER</div>
              <div style={{ display: "flex", color: "#fcd34d", fontSize: "16px", fontWeight: 900, lineHeight: 1.1 }}>{tier.title}</div>
              <div style={{ display: "flex", color: "rgba(245, 158, 11, 0.55)", fontSize: "10px", marginTop: "2px", lineHeight: 1.2 }}>{tier.sub}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: "100px", padding: "14px 16px", borderRadius: "16px", background: "rgba(24, 24, 27, 0.7)", border: "1px solid #27272a" }}>
              <div style={{ display: "flex", color: "#52525b", fontSize: "9px", fontWeight: 700, letterSpacing: "3px", marginBottom: "6px" }}>LOOTS</div>
              <div style={{ display: "flex", color: "white", fontSize: "32px", fontWeight: 900, lineHeight: 1 }}>{loots}</div>
            </div>
          </div>

          {/* Best loot */}
          {best && (
            <div style={{ display: "flex", flexDirection: "column", padding: "12px 16px", borderRadius: "14px", background: "rgba(24, 24, 27, 0.6)", border: "1px solid #27272a", marginBottom: "20px" }}>
              <div style={{ display: "flex", color: "#52525b", fontSize: "9px", fontWeight: 700, letterSpacing: "3px", marginBottom: "4px" }}>BEST LOOT</div>
              <div style={{ display: "flex", color: "#F59E0B", fontSize: "14px", fontWeight: 700 }}>{best}</div>
            </div>
          )}

          {/* Tagline */}
          <div style={{ display: "flex", color: "#a1a1aa", fontSize: "13px", fontStyle: "italic", marginBottom: "16px" }}>
            &ldquo;{tagline}&rdquo;
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "14px", borderTop: "1px solid rgba(39, 39, 42, 0.6)" }}>
            <span style={{ color: "#52525b", fontSize: "10px", fontWeight: 600 }}>loot-eta.vercel.app</span>
            <span style={{ color: "rgba(245, 158, 11, 0.6)", fontSize: "10px", fontWeight: 700 }}>Not just a deal. A loot.</span>
          </div>
        </div>

        {/* Right: CTA */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: "white", fontSize: "48px", fontWeight: 900, lineHeight: 1.05, marginBottom: "20px" }}>
              What&apos;s your Loot Report?
            </div>
            <div style={{ display: "flex", color: "#a1a1aa", fontSize: "20px", lineHeight: 1.45 }}>
              Stop overpaying. Loot finds the best deal across 11 Indian platforms.
            </div>
          </div>
          <div style={{ display: "flex", alignSelf: "flex-start", background: "#F59E0B", borderRadius: "16px", padding: "18px 32px" }}>
            <span style={{ color: "black", fontWeight: 900, fontSize: "20px" }}>Try Loot free →</span>
          </div>
          <div style={{ display: "flex", color: "#52525b", fontSize: "14px", fontWeight: 600 }}>loot-eta.vercel.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
