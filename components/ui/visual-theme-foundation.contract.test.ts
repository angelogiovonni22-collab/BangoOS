import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const themeCss = readFileSync(new URL("../../app/visual-theme.css", import.meta.url), "utf8");
const galleryCss = readFileSync(new URL("../../app/theme-gallery.css", import.meta.url), "utf8");
const futureCss = readFileSync(new URL("../../app/future-2030.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const toggle = readFileSync(new URL("./theme-toggle.tsx", import.meta.url), "utf8");
const gallery = readFileSync(new URL("./theme-gallery.tsx", import.meta.url), "utf8");
const themeOptions = readFileSync(new URL("../../lib/theme/theme-options.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../../app/(app)/settings/page.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../app/(app)/app-shell.tsx", import.meta.url), "utf8");
const pageHeader = readFileSync(new URL("./page-header.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./card.tsx", import.meta.url), "utf8");
const statusBadge = readFileSync(new URL("./status-badge.tsx", import.meta.url), "utf8");
const sectionHeader = readFileSync(new URL("./section-header.tsx", import.meta.url), "utf8");
const emptyState = readFileSync(new URL("./empty-state.tsx", import.meta.url), "utf8");
const errorState = readFileSync(new URL("./error-state.tsx", import.meta.url), "utf8");

test("visual system defines explicit light and dark semantic contracts", () => {
  assert.match(themeCss, /:root,\s*\[data-theme="light"\]/);
  assert.match(themeCss, /\[data-theme="dark"\]/);
  assert.match(themeCss, /--color-surface-card:/);
  assert.match(themeCss, /--color-text-primary:/);
  assert.match(themeCss, /--bos-bg-sidebar:/);
  assert.match(layout, /visual-theme\.css/);
});

test("theme gallery exposes persistent B.O.S. themes and experiences", () => {
  for (const themeId of ["light", "dark", "executive", "blueprint", "emerald", "graphite", "high-contrast", "digital-command", "future-2030"]) {
    assert.match(themeOptions, new RegExp(`"${themeId}"`));
  }
  assert.match(themeOptions, /experience\?: "classic" \| "future"/);
  assert.match(themeOptions, /Neon Grid Command/);
  assert.match(gallery, /role="radiogroup"/);
  assert.match(gallery, /experience/);
  assert.match(gallery, /perspective\(90px\) rotateX\(48deg\)/);
  assert.match(gallery, /localStorage\.setItem/);
  assert.match(gallery, /document\.documentElement\.dataset\.theme/);
  assert.match(settings, /ThemeGallery/);
  assert.match(settings, /t\("settings\.themesExperiences"\)/);
  assert.match(layout, /theme-gallery\.css/);
  assert.match(layout, /future-2030\.css/);
  assert.match(layout, /themeBootstrapScript/);
  assert.match(layout, /localStorage\.getItem\("bangoos-theme"\)/);
});

test("quick light-dark toggle remains compatible with gallery selections", () => {
  assert.match(toggle, /BANGO_THEME_STORAGE_KEY/);
  assert.match(toggle, /getBangoThemeOption/);
  assert.match(toggle, /localStorage\.setItem/);
  assert.match(toggle, /document\.documentElement\.dataset\.theme/);
});

test("extended themes provide semantic token packs and theme-aware accent language", () => {
  assert.match(galleryCss, /\[data-theme="executive"\]/);
  assert.match(galleryCss, /\[data-theme="blueprint"\]/);
  assert.match(galleryCss, /\[data-theme="emerald"\]/);
  assert.match(galleryCss, /\[data-theme="graphite"\]/);
  assert.match(galleryCss, /\[data-theme="high-contrast"\]/);
  assert.match(galleryCss, /\[data-theme="digital-command"\]/);
  assert.match(galleryCss, /--bos-theme-accent:/);
  assert.match(galleryCss, /\[data-bos-page-header="true"\]::before/);
  assert.match(shell, /data-bos-topbar="true"/);
});

test("Neon Grid Command is a layout-changing command experience", () => {
  assert.match(futureCss, /\[data-theme="future-2030"\]/);
  assert.match(futureCss, /--grid-cyan: #00f6ff/);
  assert.match(futureCss, /#bangoos-sidebar/);
  assert.match(futureCss, /\[data-bos-topbar="true"\]/);
  assert.match(futureCss, /perspective\(430px\) rotateX\(61deg\)/);
  assert.match(futureCss, /clip-path: polygon/);
  assert.match(futureCss, /background-size: 52px 34px/);
  assert.match(futureCss, /data-bos-card-variant="kpi"/);
  assert.match(futureCss, /\.persistentOrionPanel/);
  assert.match(futureCss, /prefers-reduced-motion/);
});

test("shared visual materials make authenticated pages dimensional and alive", () => {
  assert.match(pageHeader, /data-bos-page-header/);
  assert.match(card, /data-bos-card/);
  assert.match(card, /data-bos-card-variant/);
  assert.match(themeCss, /radial-gradient\(circle at 12% 8%/);
  assert.match(themeCss, /\[data-bos-page-header="true"\]::before/);
  assert.match(themeCss, /\[data-bos-card-variant="kpi"\]:hover/);
  assert.match(themeCss, /table tbody tr:hover/);
  assert.match(themeCss, /prefers-reduced-motion/);
});

test("primary-page uplift adds restrained navigation and status feedback", () => {
  assert.match(themeCss, /#bangoos-sidebar/);
  assert.match(themeCss, /#bangoos-sidebar nav a:hover/);
  assert.match(themeCss, /translateX\(2px\)/);
  assert.match(statusBadge, /rounded-full bg-current opacity-70/);
  assert.match(statusBadge, /gap-1\.5/);
});

test("page states retain readable surfaces while gaining BOS visual hierarchy", () => {
  assert.match(sectionHeader, /data-bos-section-header/);
  assert.match(sectionHeader, /bg-gradient-to-b/);
  assert.match(emptyState, /data-bos-empty-state/);
  assert.match(emptyState, /bg-\[var\(--bos-bg-panel\)\]/);
  assert.match(errorState, /data-bos-error-state/);
  assert.match(errorState, /color-danger-500/);
});

test("visual uplift preserves Orion provider architecture", () => {
  assert.match(shell, /GlobalOrionVoiceProvider/);
  assert.match(shell, /OrionUnifiedVoiceProvider/);
  assert.match(shell, /PersistentOrion/);
});
