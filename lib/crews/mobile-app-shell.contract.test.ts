import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),layout=readFileSync(resolve(root,"app/layout.tsx"),"utf8"),manifest=readFileSync(resolve(root,"app/manifest.ts"),"utf8"),icon=readFileSync(resolve(root,"public/bos-app-icon.svg"),"utf8");
assert.match(layout,/manifest: "\/manifest\.webmanifest"/);
assert.match(layout,/appleWebApp: \{ capable: true/);
assert.match(layout,/viewportFit: "cover"/);
assert.match(manifest,/start_url: "\/crews\/field"/);
assert.match(manifest,/display: "standalone"/);
assert.match(manifest,/purpose: "any"/);
assert.match(manifest,/purpose: "maskable"/);
assert.match(icon,/<svg/);

console.log("Mobile app shell contract checks passed.");
