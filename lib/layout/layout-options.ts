export const BANGO_LAYOUT_STORAGE_KEY = "bangoos-layout";

export type BangoLayoutId = "classic-sidebar" | "top-command";

export type BangoLayoutOption = {
  id: BangoLayoutId;
  name: string;
  description: string;
  badge: string;
};

export const BANGO_LAYOUT_OPTIONS: readonly BangoLayoutOption[] = [
  {
    id: "classic-sidebar",
    name: "Classic Sidebar",
    description: "The original B.O.S. workspace with grouped navigation anchored on the left.",
    badge: "Original",
  },
  {
    id: "top-command",
    name: "Top Command",
    description: "A completely different wide-screen command layout with the B.O.S. module navigation across the top and the full workspace opened beneath it.",
    badge: "New layout",
  },
] as const;

export function isBangoLayoutId(value: string | null): value is BangoLayoutId {
  return BANGO_LAYOUT_OPTIONS.some((layout) => layout.id === value);
}
