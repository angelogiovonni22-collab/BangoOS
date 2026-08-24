import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/(app)/dashboard/page.tsx", "utf8");
const customizer = readFileSync("components/dashboard/DashboardCustomizer.tsx", "utf8");
const header = readFileSync("components/dashboard/DashboardHeader.tsx", "utf8");
const english = JSON.parse(readFileSync("locales/en/dashboard.json", "utf8")) as Record<string, string>;
const spanish = JSON.parse(readFileSync("locales/es/dashboard.json", "utf8")) as Record<string, string>;

assert.doesNotMatch(page, /const now = new Date\(\)/, "dashboard must not derive local time during hydration");
assert.match(page, /useState<Date \| null>\(null\)/, "dashboard starts with a deterministic date state");
assert.match(page, /requestAnimationFrame\(\(\) => setLocalNow\(new Date\(\)\)\)/, "dashboard resolves local time after hydration");
assert.match(page, /aria-expanded="false"/, "collapsed widget controls expose their state");
assert.match(page, /aria-expanded="true"/, "expanded widget controls expose their state");
assert.match(page, /aria-controls=\{widgetRegionId\}/, "widget controls identify their regions");
assert.match(customizer, /aria-expanded=\{!isCollapsed\}/, "customizer widget controls expose collapse state");
assert.match(header, /dashboard\.systemReady/, "ready status is localized");

for (const dictionary of [english, spanish]) {
  assert.ok(dictionary.loadingMetrics, "loadingMetrics must be translated");
  assert.ok(dictionary.systemReady, "systemReady must be translated");
}

console.log("Dashboard hydration and accessibility contract passed.");
