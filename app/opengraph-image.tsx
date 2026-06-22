import { ImageResponse } from "next/og";

export const alt = "SocialFlow: AI Social Content Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card. Satori (the next/og engine) supports a CSS subset:
// hex/rgb colors only (no oklch), and every element with children needs an
// explicit display. Hierarchy comes from size + color contrast (the bundled
// font is single-weight), which reads as an intentional, premium look.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0b",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Violet brand glow */}
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 720,
            height: 720,
            display: "flex",
            background:
              "radial-gradient(circle, rgba(139,92,246,0.45), rgba(10,10,11,0) 70%)",
          }}
        />

        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
              color: "white",
              fontSize: 52,
            }}
          >
            S
          </div>
          <div style={{ color: "#fafafa", fontSize: 40, letterSpacing: -1 }}>
            SocialFlow
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              color: "#fafafa",
              fontSize: 78,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 940,
            }}
          >
            AI social content, from idea to published.
          </div>
          <div
            style={{
              color: "#a1a1aa",
              fontSize: 34,
              lineHeight: 1.3,
              maxWidth: 880,
            }}
          >
            Research niches, generate platform-tailored posts, then schedule and
            auto-publish everywhere.
          </div>
        </div>

        {/* Platform footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 6,
              borderRadius: 3,
              display: "flex",
              background: "#8b5cf6",
            }}
          />
          <div style={{ color: "#71717a", fontSize: 26 }}>
            Facebook · Instagram · LinkedIn · TikTok · X · YouTube
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
