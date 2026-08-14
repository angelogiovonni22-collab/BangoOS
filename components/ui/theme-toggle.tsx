"use client";

import { useEffect, useState } from "react";
import {
  BANGO_THEME_STORAGE_KEY,
  getBangoThemeOption,
  isBangoThemeId,
  type BangoThemeId,
} from "@/lib/theme/theme-options";

function applyTheme(themeId: BangoThemeId) {
  const theme = getBangoThemeOption(themeId);
  document.documentElement.dataset.theme = themeId;
  document.documentElement.style.colorScheme = theme.mode;
}

export function ThemeToggle() {
  const [themeId, setThemeId] = useState<BangoThemeId>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(BANGO_THEME_STORAGE_KEY);
    const preferred: BangoThemeId = isBangoThemeId(stored)
      ? stored
      : window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";

    applyTheme(preferred);
    const frame = window.requestAnimationFrame(() => setThemeId(preferred));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const currentMode = getBangoThemeOption(themeId).mode;
    const next: BangoThemeId = currentMode === "dark" ? "light" : "dark";
    setThemeId(next);
    window.localStorage.setItem(BANGO_THEME_STORAGE_KEY, next);
    applyTheme(next);
  }

  const currentMode = getBangoThemeOption(themeId).mode;
  const nextLabel = currentMode === "dark" ? "Switch to B.O.S. Light" : "Switch to B.O.S. Dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className="theme-toggle inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
    >
      <span aria-hidden="true" className="text-base">{currentMode === "dark" ? "☀" : "☾"}</span>
      <span className="hidden text-xs font-semibold xl:inline">{currentMode === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
