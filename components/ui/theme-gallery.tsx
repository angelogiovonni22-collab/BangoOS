"use client";

import { useEffect, useState } from "react";
import {
  BANGO_THEME_OPTIONS,
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

export function ThemeGallery() {
  const [themeId, setThemeId] = useState<BangoThemeId>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(BANGO_THEME_STORAGE_KEY);
    const preferred: BangoThemeId = isBangoThemeId(stored)
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    applyTheme(preferred);
    const frame = window.requestAnimationFrame(() => setThemeId(preferred));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function chooseTheme(nextThemeId: BangoThemeId) {
    setThemeId(nextThemeId);
    window.localStorage.setItem(BANGO_THEME_STORAGE_KEY, nextThemeId);
    applyTheme(nextThemeId);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="B.O.S. workspace theme and experience">
      {BANGO_THEME_OPTIONS.map((theme) => {
        const selected = theme.id === themeId;
        const isExperience = theme.experience === "future";

        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => chooseTheme(theme.id)}
            className={`group overflow-hidden rounded-[var(--radius-xl)] border bg-[var(--color-surface-card)] text-left shadow-[var(--shadow-small)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${
              selected
                ? "border-[var(--color-action-primary)] ring-2 ring-[color:rgb(37_99_235/0.16)]"
                : "border-[var(--color-border-subtle)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-medium)]"
            }`}
          >
            <div className="relative h-28 overflow-hidden" style={{ background: theme.preview.background }}>
              <div
                className={`absolute inset-y-0 left-0 ${isExperience ? "m-2 w-10 rounded-xl border border-white/10" : "w-12"}`}
                style={{ background: theme.preview.sidebar }}
              />
              <div
                className={`absolute border border-black/5 shadow-sm ${isExperience ? "left-16 right-3 top-2 h-7 rounded-xl border-white/10" : "left-16 right-4 top-4 h-8 rounded-lg"}`}
                style={{ background: theme.preview.panel }}
              />
              <div
                className={`absolute border border-black/5 shadow-sm ${isExperience ? "left-16 right-14 top-12 h-12 rounded-2xl border-white/10" : "left-16 right-20 top-16 h-8 rounded-lg"}`}
                style={{ background: theme.preview.panel }}
              />
              <div
                className={`absolute shadow-sm ${isExperience ? "right-3 top-12 h-12 w-8 rounded-xl" : "right-4 top-16 h-8 w-12 rounded-lg"}`}
                style={{ background: theme.preview.accent }}
              />
              <div className="absolute bottom-0 left-12 h-1.5 w-1/2" style={{ background: `linear-gradient(90deg, ${theme.preview.accent}, ${theme.preview.secondary})` }} />
              {isExperience ? (
                <div className="absolute bottom-3 left-[4.25rem] right-3 h-px opacity-70" style={{ background: `linear-gradient(90deg, ${theme.preview.accent}, transparent, ${theme.preview.secondary})` }} />
              ) : null}
              {selected ? (
                <span className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-slate-900 shadow-md" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </div>

            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-[var(--color-text-primary)]">{theme.name}</p>
                <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                  {isExperience ? "experience" : theme.mode}
                </span>
              </div>
              <p className="mt-2 text-sm leading-5 text-[var(--color-text-secondary)]">{theme.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
