import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "B.O.S. Construction Operations",
    short_name: "B.O.S.",
    description: "Secure construction operations and mobile field workflows.",
    start_url: "/crews/field",
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
