export const BANGO_THEME_STORAGE_KEY = "bangoos-theme";

export const BANGO_THEME_IDS = [
  "light",
  "dark",
  "executive",
  "blueprint",
  "emerald",
  "graphite",
  "high-contrast",
  "digital-command",
] as const;

export type BangoThemeId = (typeof BANGO_THEME_IDS)[number];

export type BangoThemeOption = {
  id: BangoThemeId;
  name: string;
  description: string;
  mode: "light" | "dark";
  preview: {
    background: string;
    panel: string;
    sidebar: string;
    accent: string;
    secondary: string;
  };
};

export const BANGO_THEME_OPTIONS: readonly BangoThemeOption[] = [
  {
    id: "light",
    name: "B.O.S. Light",
    description: "Bright enterprise workspace with crisp blue construction accents.",
    mode: "light",
    preview: { background: "#eef4fb", panel: "#ffffff", sidebar: "#0a1730", accent: "#2f7cf6", secondary: "#22c4d6" },
  },
  {
    id: "dark",
    name: "B.O.S. Dark",
    description: "Deep navy command workspace with high-clarity cool highlights.",
    mode: "dark",
    preview: { background: "#050b16", panel: "#0d182b", sidebar: "#070f1f", accent: "#4f8cff", secondary: "#2bcee0" },
  },
  {
    id: "executive",
    name: "Executive",
    description: "Warm white, charcoal, and restrained gold for leadership review.",
    mode: "light",
    preview: { background: "#f4f1ea", panel: "#fffdf9", sidebar: "#191b20", accent: "#a97826", secondary: "#d7b56d" },
  },
  {
    id: "blueprint",
    name: "Blueprint",
    description: "Technical cool-white workspace inspired by plans, steel, and cyan ink.",
    mode: "light",
    preview: { background: "#edf5fb", panel: "#fbfdff", sidebar: "#0b2740", accent: "#1677c8", secondary: "#13a7c7" },
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Clean white and navy with confident green operational accents.",
    mode: "light",
    preview: { background: "#edf6f2", panel: "#ffffff", sidebar: "#092820", accent: "#13845b", secondary: "#36b981" },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Soft gray, ink-black, and muted blue for a restrained professional look.",
    mode: "light",
    preview: { background: "#edf0f3", panel: "#fafbfc", sidebar: "#20252b", accent: "#506d8a", secondary: "#8098ad" },
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    description: "Maximum text, border, and control separation for fast scanning.",
    mode: "light",
    preview: { background: "#ffffff", panel: "#ffffff", sidebar: "#07101d", accent: "#005bd7", secondary: "#00875a" },
  },
  {
    id: "digital-command",
    name: "Digital Command",
    description: "Futuristic dark command center with electric blue and cyan energy.",
    mode: "dark",
    preview: { background: "#020711", panel: "#071426", sidebar: "#030a16", accent: "#3a86ff", secondary: "#00d4ff" },
  },
] as const;

export function isBangoThemeId(value: string | null | undefined): value is BangoThemeId {
  return Boolean(value && (BANGO_THEME_IDS as readonly string[]).includes(value));
}

export function getBangoThemeOption(themeId: BangoThemeId) {
  return BANGO_THEME_OPTIONS.find((theme) => theme.id === themeId) ?? BANGO_THEME_OPTIONS[0];
}
