import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync("app/(app)/app-shell.tsx", "utf8");
const en = readFileSync("locales/en/common.json", "utf8");
const es = readFileSync("locales/es/common.json", "utf8");

test("mobile app shell exposes a safe global back control", () => {
  assert.match(shell, /ArrowLeft/);
  assert.match(shell, /pathname && pathname !== homePath/);
  assert.match(shell, /handleMobileBack/);
  assert.match(shell, /mobileHistoryRef/);
  assert.match(shell, /mobileBackNavigationRef/);
  assert.match(shell, /router\.push\(previousPath\)/);
  assert.match(shell, /router\.push\(homePath\)/);
  assert.match(shell, /lg:hidden/);
  assert.match(shell, /aria-label=\{t\("common\.back"\)\}/);
});

test("mobile back control is localized", () => {
  assert.match(en, /"back": "Back"/);
  assert.match(es, /"back": "Atrás"/);
});

console.log("Mobile back navigation contract passed.");
