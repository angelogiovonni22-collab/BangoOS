import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B.O.S. — Bango Operating System",
    short_name: "B.O.S.",
    description: "Role-aware Bango Operating System for construction operations, field teams, trade partners, and customers.",
    start_url: "/app-entry",
    scope: "/",
    display: "standalone",
    background_color: "#050b12",
    theme_color: "#050b12",
    orientation: "any",
    icons: [
      { src: "/api/app-icon-v3/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/app-icon-v3/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/app-icon-v3/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
