import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const globals = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const toggle = readFileSync(new URL("./theme-toggle.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../app/(app)/app-shell.tsx", import.meta.url), "utf8");

test("visual system defines explicit light and dark theme contracts", () => {
  assert.match(globals, /:root(?:,|\s)*\[data-theme=["']light["']\]/i);
  assert.match(globals, /\[data-theme=["']dark["']\]/i);
  assert.match(globals, /--color-surface-card:/);
  assert.match(globals, /--color-text-primary:/);
  assert.match(globals, /--bos-bg-sidebar:/);
});

test("theme toggle persists the user's selection", () => {
  assert.match(toggle, /bangoos-theme/);
  assert.match(toggle, /localStorage\.setItem/);
  assert.match(toggle, /document\.documentElement\.dataset\.theme/);
});

test("authenticated shell exposes the theme toggle without changing Orion providers", () => {
  assert.match(shell, /ThemeToggle/);
  assert.match(shell, /GlobalOrionVoiceProvider/);
  assert.match(shell, /OrionUnifiedVoiceProvider/);
  assert.match(shell, /PersistentOrion/);
});
