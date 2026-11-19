import type { NextConfig } from "next";

// Content Security Policy: only the services Kondora talks to.
// script-src keeps 'unsafe-inline' because Next.js inlines its bootstrap scripts.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  [
    "connect-src 'self'",
    "https://*.convex.cloud wss://*.convex.cloud https://*.convex.site",
    "https://fullnode.testnet.sui.io:443 https://fullnode.testnet.sui.io",
    "https://*.sui.io https://*.mystenlabs.com https://*.walrus.space",
    
    
  ].join(" "),
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  // Art ships pre-optimized as WebP; serving it directly avoids the Vercel
  // image optimization quota (free plan) entirely.
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: CSP },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
