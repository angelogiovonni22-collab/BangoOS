import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "public/orion-sw.js"), "utf8");
const pushClient = fs.readFileSync(path.join(root, "lib/orion/personal-assistant/push-client.ts"), "utf8");

assert.match(nextConfig, /source: "\/projects\/:path\*"/);
assert.match(nextConfig, /private, no-store, no-cache, max-age=0, must-revalidate/);
assert.match(nextConfig, /Vercel-CDN-Cache-Control/);
assert.match(nextConfig, /source: "\/orion-sw\.js"/);
assert.match(serviceWorker, /self\.skipWaiting\(\)/);
assert.match(serviceWorker, /self\.clients\.claim\(\)/);
assert.match(pushClient, /updateViaCache: "none"/);
assert.match(pushClient, /registration\.update\(\)/);

console.log("Safari project deployment cache policy contract passed.");
