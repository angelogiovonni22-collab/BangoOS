import type { MetadataRoute } from "next";

const APP_ICON = "/branding/bos-operating-system-logo.png";

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
      { src: APP_ICON, sizes: "any", type: "image/png", purpose: "any" },
      { src: APP_ICON, sizes: "any", type: "image/png", purpose: "maskable" },
    ],
  };
}
