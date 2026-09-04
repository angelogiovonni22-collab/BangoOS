export const BANGO_THEME_STORAGE_KEY = "bangoos-theme";
export const BANGO_NEON_ACCENT_STORAGE_KEY = "bangoos-neon-accent";

export const BANGO_THEME_IDS = [
  "light",
  "dark",
  "executive",
  "blueprint",
  "emerald",
  "graphite",
  "high-contrast",
  "digital-command",
  "future-2030",
] as const;

export type BangoThemeId = (typeof BANGO_THEME_IDS)[number];
export const BANGO_DEFAULT_THEME_ID: BangoThemeId = "digital-command";

export const BANGO_NEON_ACCENT_IDS = [
  "cyan",
  "blue",
  "red",
  "green",
  "white",
  "orange",
  "yellow",
  "purple",
] as const;

export type BangoNeonAccentId = (typeof BANGO_NEON_ACCENT_IDS)[number];

export type BangoNeonAccentOption = {
  id: BangoNeonAccentId;
  name: string;
  color: string;
  secondary: string;
};

export const BANGO_NEON_ACCENT_OPTIONS: readonly BangoNeonAccentOption[] = [
  { id: "cyan", name: "Cyan", color: "#00f6ff", secondary: "#2d7dff" },
  { id: "blue", name: "Blue", color: "#3a86ff", secondary: "#68b5ff" },
  { id: "red", name: "Red", color: "#ff3b4f", secondary: "#ff7a64" },
  { id: "green", name: "Green", color: "#39ff88", secondary: "#00d98b" },
  { id: "white", name: "White", color: "#f4fbff", secondary: "#a8c8dc" },
  { id: "orange", name: "Orange", color: "#ff8a2a", secondary: "#ffbd45" },
  { id: "yellow", name: "Yellow", color: "#ffe34a", secondary: "#ffab2e" },
  { id: "purple", name: "Purple", color: "#b66cff", secondary: "#6f7cff" },
] as const;

export type BangoThemeOption = {
  id: BangoThemeId;
  name: string;
  description: string;
  mode: "light" | "dark";
  experience?: "classic" | "future";
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
  {
    id: "future-2030",
    name: "Neon Grid Command",
    description: "A true layout experience with a black glass command deck, luminous grid, HUD framing, and selectable neon accent colors.",
    mode: "dark",
    experience: "future",
    preview: { background: "#010306", panel: "#041018", sidebar: "#02080d", accent: "#00f6ff", secondary: "#2d7dff" },
  },
] as const;

export function isBangoThemeId(value: string | null | undefined): value is BangoThemeId {
  return Boolean(value && (BANGO_THEME_IDS as readonly string[]).includes(value));
}

export function isBangoNeonAccentId(value: string | null | undefined): value is BangoNeonAccentId {
  return Boolean(value && (BANGO_NEON_ACCENT_IDS as readonly string[]).includes(value));
}

export function getBangoThemeOption(themeId: BangoThemeId) {
  return BANGO_THEME_OPTIONS.find((theme) => theme.id === themeId)
    ?? BANGO_THEME_OPTIONS.find((theme) => theme.id === BANGO_DEFAULT_THEME_ID)!;
}
