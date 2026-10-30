import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:8000";
const S3_URL = process.env.S3_URL ?? "http://localhost:9000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Rewrites buffer bodies (10MB default); photo uploads go through /s3. Matches the API's 50MB cap.
    // shortcut: buffers in memory; at scale set S3_PUBLIC_URL to the bucket itself so uploads skip Next.
    proxyClientMaxBodySize: "55mb",
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
