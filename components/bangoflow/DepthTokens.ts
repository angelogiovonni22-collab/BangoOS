export const DEPTH_TOKENS = {
  shell: "var(--z-base)",
  surface: "var(--z-base)",
  header: "var(--z-header)",
  overlay: "var(--z-overlay)",
  dialog: "var(--z-modal)",
  spotlight: "var(--z-toast)",
} as const;

export type DepthLayer = keyof typeof DEPTH_TOKENS;

export function resolveDepthClassName(layer: DepthLayer) {
  if (layer === "header") {
    return "relative z-[var(--z-header)]";
  }

  if (layer === "overlay") {
    return "relative z-[var(--z-overlay)]";
  }

  if (layer === "dialog") {
    return "relative z-[var(--z-modal)]";
  }

  if (layer === "spotlight") {
    return "relative z-[var(--z-toast)]";
  }

  return "relative z-[var(--z-base)]";
}