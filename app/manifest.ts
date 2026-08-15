import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B.O.S. — Bango Operating System",
    short_name: "B.O.S.",
    description: "Role-aware Bango Operating System for construction operations, field teams, trade partners, and customers.",
    start_url: "/app-entry",
    scope: "/",
    display: "standalone",
    background_color: "#0a1222",
    theme_color: "#0a1222",
    orientation: "any",
    icons: [
      { src: "/bos-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/bos-app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
