import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: do NOT set `output: "standalone"` — that mode is for self-hosting
  // (e.g. Docker, VPS) and bundles everything into a single .next/standalone
  // server. On Vercel, it prevents API routes from being detected as
  // serverless functions, so /api/telegram ends up returning 404.

  reactStrictMode: true,

  // Surface real TS errors during build instead of silently shipping bugs.
  typescript: {
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
