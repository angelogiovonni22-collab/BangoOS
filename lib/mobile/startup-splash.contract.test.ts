import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const layout = read("app/layout.tsx");
const startup = read("components/startup/BosStartupIntro.tsx");
const splashRoute = read("app/api/app-splash/[width]/[height]/route.tsx");

assert.match(layout, /rel="apple-touch-startup-image"/);
assert.match(layout, /themeColor:\s*"#000000"/);
assert.match(layout, /bos-startup-prepaint/);
assert.match(splashRoute, /background:\s*"#000000"/);
assert.match(startup, /visibilitychange/);
assert.match(startup, /display-mode:\s*standalone/);
assert.match(startup, /setRunId\(\(current\) => current \+ 1\)/);
assert.doesNotMatch(startup, /sessionStorage/);

console.log("B.O.S. startup splash contract checks passed.");
