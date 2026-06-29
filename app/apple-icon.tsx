import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — the SocialFlow orbit mark on ink, sized for home screens.
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
          background: "#15141b",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 122,
            height: 122,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 114,
              height: 114,
              borderRadius: 9999,
              border: "10px solid #f4f2ec",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 32,
              height: 32,
              borderRadius: 9999,
              background: "#f4f2ec",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 38,
              height: 38,
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
