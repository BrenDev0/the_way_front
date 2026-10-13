import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next build` also writes a self-contained server to .next/standalone, which the
  // Dockerfile ships instead of node_modules. `next dev` and `next start` are unchanged.
  output: "standalone",
};

export default nextConfig;
