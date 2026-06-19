import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root: another package-lock.json exists higher up on this
  // machine, and Next would otherwise infer the wrong root for file tracing.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
