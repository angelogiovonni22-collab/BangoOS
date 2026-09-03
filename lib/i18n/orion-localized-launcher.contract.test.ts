import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../../app/sidebar-uniform-background.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../app/(app)/app-shell.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../components/orion/persistent/PersistentOrionPanel.tsx", import.meta.url), "utf8");

test("desktop temporary Orion launcher stays hidden in English and Spanish", () => {
  assert.match(css, /header\[data-bos-topbar="true"\] button\[aria-label="Open Orion"\]/);
  assert.match(css, /header\[data-bos-topbar="true"\] button\[aria-label="Abrir Orion"\]/);
  assert.match(css, /pointer-events:\s*none !important/);
});

test("canonical persistent Orion remains the visible launcher and original panel", () => {
  assert.match(shell, /<PersistentOrion/);
  assert.match(css, /\[aria-label="Persistent Orion surface"\] \.persistentOrionButton/);
  assert.match(panel, /persistentOrionPanelOriginal/);
  assert.match(panel, /Open Advanced Orion/);
});
