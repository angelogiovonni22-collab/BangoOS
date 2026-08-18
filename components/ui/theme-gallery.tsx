"use client";

import { useEffect, useState } from "react";
import {
  BANGO_NEON_ACCENT_OPTIONS,
  BANGO_NEON_ACCENT_STORAGE_KEY,
  BANGO_THEME_OPTIONS,
  BANGO_THEME_STORAGE_KEY,
  getBangoThemeOption,
  isBangoNeonAccentId,
  isBangoThemeId,
  type BangoNeonAccentId,
  type BangoThemeId,
} from "@/lib/theme/theme-options";

function applyTheme(themeId: BangoThemeId) {
  const theme = getBangoThemeOption(themeId);
  document.documentElement.dataset.theme = themeId;
  document.documentElement.style.colorScheme = theme.mode;
}

function applyNeonAccent(accentId: BangoNeonAccentId) {
  document.documentElement.dataset.neonAccent = accentId;
}

export function ThemeGallery() {
  const [themeId, setThemeId] = useState<BangoThemeId>("light");
  const [neonAccent, setNeonAccent] = useState<BangoNeonAccentId>("cyan");

  useEffect(() => {
    const stored = window.localStorage.getItem(BANGO_THEME_STORAGE_KEY);
    const storedAccent = window.localStorage.getItem(BANGO_NEON_ACCENT_STORAGE_KEY);
    const preferred: BangoThemeId = isBangoThemeId(stored)
      ? stored
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    const preferredAccent: BangoNeonAccentId = isBangoNeonAccentId(storedAccent) ? storedAccent : "cyan";

    applyTheme(preferred);
    applyNeonAccent(preferredAccent);
    const frame = window.requestAnimationFrame(() => {
      setThemeId(preferred);
      setNeonAccent(preferredAccent);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function chooseTheme(nextThemeId: BangoThemeId) {
    setThemeId(nextThemeId);
    window.localStorage.setItem(BANGO_THEME_STORAGE_KEY, nextThemeId);
    applyTheme(nextThemeId);
  }

  function chooseNeonAccent(nextAccent: BangoNeonAccentId) {
    setNeonAccent(nextAccent);
    window.localStorage.setItem(BANGO_NEON_ACCENT_STORAGE_KEY, nextAccent);
    applyNeonAccent(nextAccent);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="B.O.S. workspace theme and experience">
        {BANGO_THEME_OPTIONS.map((theme) => {
          const selected = theme.id === themeId;
          const isExperience = theme.experience === "future";
          const previewAccent = isExperience
            ? BANGO_NEON_ACCENT_OPTIONS.find((option) => option.id === neonAccent)?.color ?? theme.preview.accent
            : theme.preview.accent;
          const previewSecondary = isExperience
            ? BANGO_NEON_ACCENT_OPTIONS.find((option) => option.id === neonAccent)?.secondary ?? theme.preview.secondary
            : theme.preview.secondary;

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
                {isExperience ? (
                  <>
                    <div
                      className="absolute inset-x-0 bottom-0 h-[58%] opacity-70"
                      style={{
                        backgroundImage: `linear-gradient(${previewAccent}22 1px, transparent 1px), linear-gradient(90deg, ${previewAccent}22 1px, transparent 1px)`,
                        backgroundSize: "16px 12px",
                        transform: "perspective(90px) rotateX(48deg) scale(1.35)",
                        transformOrigin: "center bottom",
                      }}
                    />
                    <div className="absolute inset-y-2 left-2 w-10 border" style={{ background: theme.preview.sidebar, borderColor: `${previewAccent}66`, boxShadow: `0 0 12px ${previewAccent}22` }} />
                    <div className="absolute left-16 right-3 top-2 h-6 border" style={{ background: theme.preview.panel, borderColor: `${previewAccent}55`, boxShadow: `0 0 10px ${previewAccent}18` }} />
                    <div className="absolute left-16 right-[4.1rem] top-12 h-12 border" style={{ background: theme.preview.panel, borderColor: `${previewAccent}44` }} />
                    <div className="absolute right-3 top-12 h-12 w-12 border" style={{ background: theme.preview.panel, borderColor: `${previewAccent}66`, boxShadow: `inset 2px 0 ${previewAccent}` }} />
                    <div className="absolute left-16 right-3 top-[2.35rem] h-px" style={{ background: `linear-gradient(90deg, ${previewAccent}, ${previewSecondary} 70%, transparent)`, boxShadow: `0 0 6px ${previewAccent}` }} />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-y-0 left-0 w-12" style={{ background: theme.preview.sidebar }} />
                    <div className="absolute left-16 right-4 top-4 h-8 rounded-lg border border-black/5 shadow-sm" style={{ background: theme.preview.panel }} />
                    <div className="absolute left-16 right-20 top-16 h-8 rounded-lg border border-black/5 shadow-sm" style={{ background: theme.preview.panel }} />
                    <div className="absolute right-4 top-16 h-8 w-12 rounded-lg shadow-sm" style={{ background: theme.preview.accent }} />
                    <div className="absolute bottom-0 left-12 h-1.5 w-1/2" style={{ background: `linear-gradient(90deg, ${theme.preview.accent}, ${theme.preview.secondary})` }} />
                  </>
                )}
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

      {themeId === "future-2030" ? (
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-[var(--color-text-primary)]">Neon Grid Color</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Choose the glow, grid, active-navigation, focus, and command accent color.</p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Saved on this device</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-3" role="radiogroup" aria-label="Neon Grid Command color">
            {BANGO_NEON_ACCENT_OPTIONS.map((option) => {
              const selected = option.id === neonAccent;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.name}
                  onClick={() => chooseNeonAccent(option.id)}
                  className={`flex min-w-20 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${selected ? "border-[var(--color-text-primary)] bg-[var(--color-surface-subtle)]" : "border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)]"}`}
                >
                  <span className="h-4 w-4 rounded-full border border-white/30" style={{ background: option.color, boxShadow: `0 0 10px ${option.color}88` }} aria-hidden="true" />
                  <span className="text-[var(--color-text-primary)]">{option.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
