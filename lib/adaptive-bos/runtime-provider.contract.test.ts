import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const provider = fs.readFileSync(path.join(root, "lib/adaptive-bos/provider.tsx"), "utf8");
const layout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");

assert(provider.includes("AdaptiveBosProvider"));
assert(provider.includes("useAdaptiveBos"));
assert(provider.includes("hasModule"));
assert(provider.includes("term:"));
assert(provider.includes("dataset.bosIndustry"));
assert(layout.includes('from("company_operating_profiles")'), "Authenticated shell must load the tenant operating profile");
assert(layout.includes('industryKey: "construction"'), "Missing profiles must remain construction by default");
assert(layout.includes("resolveAdaptiveBosConfig"));
assert(layout.includes("<AdaptiveBosProvider config={adaptiveConfig}>"), "All authenticated B.O.S. pages must receive adaptive runtime configuration");

console.log("Adaptive B.O.S. runtime provider contract passed");
