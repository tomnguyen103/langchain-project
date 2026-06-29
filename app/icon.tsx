import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Branded favicon: the SocialFlow orbit mark — a thin ring with a live ember
// node — on ink, matching the OG card and app icon.
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
          background: "#15141b",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 9999,
              border: "2px solid #f4f2ec",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 6,
              height: 6,
              borderRadius: 9999,
              background: "#f4f2ec",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 7,
              height: 7,
              borderRadius: 9999,
              background: "#c2703d",
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
