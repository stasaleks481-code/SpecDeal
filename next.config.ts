import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: do NOT set `output: "standalone"` — that mode is for self-hosting
  // (e.g. Docker, VPS) and bundles everything into a single .next/standalone
  // server. On Vercel, it prevents API routes from being detected as
  // serverless functions, so /api/telegram ends up returning 404.

  reactStrictMode: true,

  // Next.js 16 removed the `eslint` config option from NextConfig.
  // Linting is now done via standalone `eslint` CLI (see package.json "lint" script).

  // Next.js 16 also removed `typescript.ignoreBuildErrors` — TS errors will
  // now properly fail the build, which is what we want.
};

export default nextConfig;
