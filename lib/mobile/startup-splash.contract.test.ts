import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const layout = read("app/layout.tsx");
const startup = read("components/startup/BosStartupIntro.tsx");
const startupStyles = read("components/startup/BosStartupIntro.module.css");
const splashRoute = read("app/api/app-splash/[width]/[height]/route.tsx");

assert.match(layout, /rel="apple-touch-startup-image"/);
assert.match(layout, /themeColor:\s*"#000000"/);
assert.match(layout, /bos-startup-prepaint/);
assert.match(splashRoute, /background:\s*"#000000"/);

assert.match(startup, /const LOAD_TIMEOUT_MS = 1200/);
assert.match(startup, /const FALLBACK_HOLD_MS = 900/);
assert.match(startup, /fallbackReady/);
assert.match(startup, /priority/);
assert.match(startupStyles, /z-index:\s*2147483647/);
assert.match(startupStyles, /background:\s*#000/);
assert.match(startupStyles, /\.fallbackReady/);

assert.doesNotMatch(startup, /visibilitychange/);
assert.doesNotMatch(startup, /REOPEN_THRESHOLD_MS/);
assert.doesNotMatch(startup, /display-mode:\s*standalone/);
assert.doesNotMatch(startup, /setRunId/);
assert.doesNotMatch(startup, /sessionStorage/);
assert.doesNotMatch(startup, /LOAD_TIMEOUT_MS = 5000/);

console.log("B.O.S. startup splash contract checks passed.");
