import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "My Loot Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

export default async function OGImage({
  searchParams,
}: {
  searchParams: Promise<{ savings?: string; loots?: string; name?: string; persona?: string; best?: string }>;
}) {
  const { savings: s, loots: l, name: n, persona: p, best: b } = await searchParams;
  const savings = parseInt(s ?? "0") || 0;
  const loots = parseInt(l ?? "0") || 0;
  const name = n ?? "";
  const persona = p ?? "value_hunter";
  const best = b ?? "";

  const formattedSavings = `₹${savings.toLocaleString("en-IN")}`;
  const personaLabel = PERSONA_LABELS[persona] ?? "Smart Shopper 🛍️";
  const tagline = PERSONA_TAGLINES[persona] ?? "Shop smarter. Save more.";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#050505",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "40px",
          gap: "60px",
        }}
      >
        {/* Left: Loot Report Card */}
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #27272a",
            borderRadius: "28px",
            padding: "40px",
            width: "420px",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "28px" }}>
            <span style={{ color: "#F59E0B", fontSize: "26px", fontWeight: 900 }}>Loot</span>
            <span style={{ color: "#52525b", fontSize: "13px" }}>2026 Report</span>
          </div>

          {name && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ color: "#52525b", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "4px" }}>
                {name}&apos;s Shopping Year
              </div>
              <div style={{ color: "white", fontSize: "15px", fontWeight: 700 }}>{personaLabel}</div>
            </div>
          )}

          <div style={{ marginBottom: "24px" }}>
            <div style={{ color: "#52525b", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "8px" }}>
              DEALS FOUND
            </div>
            <div style={{ color: "white", fontSize: savings >= 10000 ? "56px" : "64px", fontWeight: 900, lineHeight: 1 }}>
              {formattedSavings}
            </div>
            <div style={{ color: "#71717a", fontSize: "13px", marginTop: "8px" }}>vs listed price</div>
          </div>

          <div style={{ display: "flex", gap: "32px", paddingTop: "20px", borderTop: "1px solid #18181b", marginBottom: "20px" }}>
            <div>
              <div style={{ color: "#52525b", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase" }}>LOOTS</div>
              <div style={{ color: "white", fontSize: "28px", fontWeight: 900 }}>{loots}</div>
            </div>
            {best && (
              <div>
                <div style={{ color: "#52525b", fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase" }}>BEST LOOT</div>
                <div style={{ color: "#F59E0B", fontSize: "13px", fontWeight: 700, marginTop: "4px" }}>{best}</div>
              </div>
            )}
          </div>

          <div style={{ paddingTop: "16px", borderTop: "1px solid #18181b" }}>
            <div style={{ color: "#52525b", fontSize: "12px", fontStyle: "italic" }}>
              &ldquo;{tagline}&rdquo;
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #18181b" }}>
            <span style={{ color: "#3f3f46", fontSize: "10px" }}>loot-eta.vercel.app</span>
            <span style={{ color: "#3f3f46", fontSize: "10px" }}>Not just a deal. A loot.</span>
          </div>
        </div>

        {/* Right: Call to action */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <div style={{ color: "white", fontSize: "42px", fontWeight: 900, lineHeight: 1.1, marginBottom: "16px" }}>
              What&apos;s your<br />Loot Report?
            </div>
            <div style={{ color: "#71717a", fontSize: "18px", lineHeight: 1.5 }}>
              Stop overpaying. Loot finds<br />the best deal across 11 platforms.
            </div>
          </div>
          <div
            style={{
              background: "#F59E0B",
              borderRadius: "14px",
              padding: "16px 28px",
              color: "black",
              fontWeight: 900,
              fontSize: "18px",
              display: "inline-flex",
              width: "fit-content",
            }}
          >
            Try Loot free →
          </div>
          <div style={{ color: "#3f3f46", fontSize: "14px" }}>loot-eta.vercel.app</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
