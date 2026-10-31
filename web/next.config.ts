import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const S3_URL = process.env.S3_URL ?? "http://localhost:9000";

const nextConfig: NextConfig = {
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  // Let phones on the same network open the dev server (incl. HMR) via this machine's LAN IP.
  allowedDevOrigins: Object.values(networkInterfaces())
    .flat()
    .flatMap((i) => (i?.family === "IPv4" ? [i.address] : [])),
  experimental: {
    // Reuse visited screens on client navigation; mutations and live updates still call router.refresh().
    staleTimes: { dynamic: 300 },
    // Rewrites buffer bodies (10MB default); uploads go through /s3. Covers the API's caps (50MB photos, 200MB videos).
    // shortcut: buffers in memory; at scale set S3_PUBLIC_URL to the bucket itself so uploads skip Next.
    proxyClientMaxBodySize: "205mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Same-origin proxy: the session cookie just works, and phones only need to reach this server.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/s3/:path*", destination: `${S3_URL}/:path*` },
    ];
  },
};

export default nextConfig;
