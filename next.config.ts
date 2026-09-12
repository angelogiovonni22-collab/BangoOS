import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const appShellNoStoreHeaders = [
  { key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" },
  { key: "CDN-Cache-Control", value: "no-store" },
  { key: "Vercel-CDN-Cache-Control", value: "no-store" },
];

const appShellNoStoreSources = [
  "/app-entry/:path*",
  "/dashboard/:path*",
  "/operations/:path*",
  "/timeline/:path*",
  "/dispatch/:path*",
  "/daily-reports/:path*",
  "/schedule/:path*",
  "/projects/:path*",
  "/blueprints/:path*",
  "/estimates/:path*",
  "/invoices/:path*",
  "/change-orders/:path*",
  "/labor-rates/:path*",
  "/customers/:path*",
  "/materials/:path*",
  "/units-of-measure/:path*",
  "/equipment/:path*",
  "/vendors/:path*",
  "/employees/:path*",
  "/crews/:path*",
  "/settings/:path*",
  "/trade-partner-messages/:path*",
  "/platform-admin/:path*",
  "/cost-codes/:path*",
  "/customer-portal/:path*",
  "/team/:path*",
  "/onboarding/:path*",
];

const nextConfig: NextConfig = {
  // Keep pdfjs and its native canvas binding external so pdfjs can resolve its sibling worker
  // from the installed package instead of a Turbopack server chunk at runtime.
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/blueprints/*/generate-3d": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/blueprints/*/visual-mockup": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", "./node_modules/sharp/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      ...appShellNoStoreSources.map((source) => ({
        source,
        headers: appShellNoStoreHeaders,
      })),
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
