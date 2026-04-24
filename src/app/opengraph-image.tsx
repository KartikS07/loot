import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Loot — Not just a deal. A loot.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#050505",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        {/* Card */}
        <div
          style={{
            background: "#0a0a0a",
            border: "1px solid #27272a",
            borderRadius: "32px",
            padding: "48px",
            width: "600px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px" }}>
            <span style={{ color: "#F59E0B", fontSize: "28px", fontWeight: 900 }}>Loot</span>
            <span style={{ color: "#52525b", fontSize: "14px" }}>2026 Report</span>
          </div>

          {/* Big number */}
          <div style={{ marginBottom: "32px" }}>
            <div style={{ color: "#52525b", fontSize: "12px", letterSpacing: "4px", textTransform: "uppercase", marginBottom: "8px" }}>
              DEALS FOUND
            </div>
            <div style={{ color: "white", fontSize: "72px", fontWeight: 900, lineHeight: 1 }}>
              ₹14,200
            </div>
            <div style={{ color: "#71717a", fontSize: "14px", marginTop: "8px" }}>
              vs listed price across 11 platforms
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "40px", paddingTop: "24px", borderTop: "1px solid #18181b" }}>
            <div>
              <div style={{ color: "#52525b", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>LOOTS</div>
              <div style={{ color: "white", fontSize: "32px", fontWeight: 900 }}>8</div>
            </div>
            <div>
              <div style={{ color: "#52525b", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" }}>PERSONA</div>
              <div style={{ color: "white", fontSize: "18px", fontWeight: 700 }}>Value Hunter 🎯</div>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div style={{ marginTop: "40px", textAlign: "center" }}>
          <div style={{ color: "white", fontSize: "32px", fontWeight: 900, marginBottom: "12px" }}>
            What&apos;s your Loot Report?
          </div>
          <div style={{ color: "#71717a", fontSize: "18px" }}>
            loot-eta.vercel.app · Not just a deal. A loot.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
