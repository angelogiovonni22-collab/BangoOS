"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "bangoos-theme";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const preferred: ThemeMode = stored === "light" || stored === "dark"
      ? stored
      : window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";

    applyTheme(preferred);
    const frame = window.requestAnimationFrame(() => setTheme(preferred));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  const nextLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className="theme-toggle inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] transition hover:bg-[var(--bos-bg-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
    >
      <span aria-hidden="true" className="text-base">{theme === "dark" ? "☀" : "☾"}</span>
      <span className="hidden text-xs font-semibold xl:inline">{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
