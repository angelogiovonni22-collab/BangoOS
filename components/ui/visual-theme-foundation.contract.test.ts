import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const themeCss = readFileSync(new URL("../../app/visual-theme.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const toggle = readFileSync(new URL("./theme-toggle.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../../app/(app)/settings/page.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../app/(app)/app-shell.tsx", import.meta.url), "utf8");
const pageHeader = readFileSync(new URL("./page-header.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("./card.tsx", import.meta.url), "utf8");
const statusBadge = readFileSync(new URL("./status-badge.tsx", import.meta.url), "utf8");

test("visual system defines explicit light and dark semantic contracts", () => {
  assert.match(themeCss, /:root,\s*\[data-theme="light"\]/);
  assert.match(themeCss, /\[data-theme="dark"\]/);
  assert.match(themeCss, /--color-surface-card:/);
  assert.match(themeCss, /--color-text-primary:/);
  assert.match(themeCss, /--bos-bg-sidebar:/);
  assert.match(layout, /visual-theme\.css/);
});

test("theme toggle persists the user's selection", () => {
  assert.match(toggle, /bangoos-theme/);
  assert.match(toggle, /localStorage\.setItem/);
  assert.match(toggle, /document\.documentElement\.dataset\.theme/);
  assert.match(settings, /ThemeToggle/);
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

test("visual uplift preserves Orion provider architecture", () => {
  assert.match(shell, /GlobalOrionVoiceProvider/);
  assert.match(shell, /OrionUnifiedVoiceProvider/);
  assert.match(shell, /PersistentOrion/);
});
