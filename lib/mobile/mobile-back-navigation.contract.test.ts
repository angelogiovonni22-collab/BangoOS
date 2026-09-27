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


test("mobile app shell supports pull-to-refresh and a visible refresh control", () => {
  assert.match(shell, /RefreshCw/);
  assert.match(shell, /data-bos-mobile-refresh-button/);
  assert.match(shell, /data-bos-mobile-refresh-indicator/);
  assert.match(shell, /touchstart/);
  assert.match(shell, /touchmove/);
  assert.match(shell, /touchend/);
  assert.match(shell, /pullDistanceRef/);
  assert.match(shell, /Release to refresh/);
  assert.match(shell, /window\.location\.reload\(\)/);
  assert.match(shell, /bos-mobile-refresh-url/);
  assert.match(shell, /bos-mobile-refresh-scroll-y/);
  assert.match(shell, /window\.scrollTo/);
  assert.match(shell, /event\.preventDefault\(\)/);
  assert.match(shell, /window\.innerWidth >= 1024/);
});
