import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Branded favicon (replaces the create-next-app default): violet gradient tile
// with the SocialFlow "S", matching the OG card and app icon.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 7,
          background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
          color: "white",
          fontSize: 22,
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
