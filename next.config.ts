import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: another package-lock.json exists higher up on this
  // machine, and Next would otherwise infer the wrong root for file tracing.
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      // A2A discovery: /.well-known/agent-card.json → /api/a2a (GET)
      {
        source: "/.well-known/agent-card.json",
        destination: "/api/a2a",
      },
    ];
  },
};

export default nextConfig;
