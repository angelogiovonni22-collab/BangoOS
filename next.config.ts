import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // pdfjs-dist uses @napi-rs/canvas for Node-side PDF rendering. Keep its native binding external
  // to Turbopack's ESM chunks so the server runtime loads the installed platform package directly.
  serverExternalPackages: ["@napi-rs/canvas"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/projects/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" },
          { key: "CDN-Cache-Control", value: "no-store" },
          { key: "Vercel-CDN-Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/orion-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
