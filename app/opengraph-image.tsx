import { ImageResponse } from "next/og";

export const alt = "SocialFlow: AI Social Content Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card, matching the "Ink & Porcelain" marketing brand.
// Satori (the next/og engine) supports a CSS subset: hex/rgb colors only (no
// oklch / color-mix), and every element with children needs an explicit display.
// The orbit mark is drawn with positioned divs; hierarchy comes from size + color.
const INK = "#15141b";
const PORCELAIN = "#f4f2ec";
const MUTED = "#a6a2ae";
const EMBER = "#c2703d";

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
          background: INK,
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Ember signal glow */}
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 720,
            height: 720,
            display: "flex",
            background: `radial-gradient(circle, rgba(194,112,61,0.40), rgba(21,20,27,0) 70%)`,
          }}
        />

        {/* Wordmark with the orbit mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              position: "relative",
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 66,
                height: 66,
                borderRadius: 9999,
                border: `3px solid ${PORCELAIN}`,
                display: "flex",
                opacity: 0.85,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 16,
                height: 16,
                borderRadius: 9999,
                background: PORCELAIN,
                display: "flex",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 18,
                height: 18,
                borderRadius: 9999,
                background: EMBER,
                display: "flex",
              }}
            />
          </div>
          <div style={{ color: PORCELAIN, fontSize: 38, letterSpacing: -0.5 }}>
            SocialFlow
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              color: PORCELAIN,
              fontSize: 76,
              lineHeight: 1.04,
              letterSpacing: -2,
              maxWidth: 980,
            }}
          >
            Set the strategy. The agent runs everything else.
          </div>
          <div
            style={{
              color: MUTED,
              fontSize: 32,
              lineHeight: 1.3,
              maxWidth: 900,
            }}
          >
            Research niches, draft posts in your voice, then schedule and
            auto-publish across eight platforms.
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
              background: EMBER,
            }}
          />
          <div style={{ color: "#71717a", fontSize: 22 }}>
            Instagram · YouTube · TikTok · LinkedIn · Facebook · Pinterest ·
            Discord · X
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
