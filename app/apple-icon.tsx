import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — same brand mark as the favicon, sized for home screens.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
          color: "white",
          fontSize: 116,
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
