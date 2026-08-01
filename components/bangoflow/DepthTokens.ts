export const DEPTH_TOKENS = {
  application: "var(--z-base)",
  shell: "var(--z-base)",
  surface: "var(--z-base)",
  stickyNav: "var(--z-header)",
  header: "var(--z-header)",
  popover: "var(--z-popover)",
  overlay: "var(--z-overlay)",
  backdrop: "var(--z-backdrop)",
  dialog: "var(--z-modal)",
  spotlight: "var(--z-spotlight)",
  criticalAlert: "var(--z-critical)",
} as const;

export const LAYER_HIERARCHY = [
  "application",
  "stickyNav",
  "popover",
  "backdrop",
  "dialog",
  "spotlight",
  "criticalAlert",
] as const;

export type DepthLayer = keyof typeof DEPTH_TOKENS;
export type LayerHierarchy = typeof LAYER_HIERARCHY[number];

export function resolveDepthClassName(layer: DepthLayer) {
  return `relative z-[${DEPTH_TOKENS[layer]}]`;
}

export function classifyDepthLayer(layer: DepthLayer): LayerHierarchy {
  if (layer === "application" || layer === "shell" || layer === "surface") {
    return "application";
  }

  if (layer === "stickyNav" || layer === "header") {
    return "stickyNav";
  }

  if (layer === "popover" || layer === "overlay") {
    return "popover";
  }

  if (layer === "backdrop") {
    return "backdrop";
  }

  if (layer === "dialog") {
    return "dialog";
  }

  if (layer === "spotlight") {
    return "spotlight";
  }

  return "criticalAlert";
}