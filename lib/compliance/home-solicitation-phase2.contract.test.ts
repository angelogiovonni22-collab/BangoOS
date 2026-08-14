import fs from "node:fs";
import assert from "node:assert/strict";

const required = [
  "lib/compliance/ohio-home-solicitation.ts",
  "lib/compliance/home-solicitation-service.ts",
  "components/estimates/home-solicitation-compliance-panel.tsx",
  "components/estimates/home-solicitation-seller-signature.tsx",
  "app/api/contracts/estimate/[token]/cancel/route.ts",
  "supabase/migrations/20260814133000_estimate_home_solicitation_compliance.sql",
  "supabase/migrations/20260814140000_home_solicitation_start_hold.sql",
  "supabase/migrations/20260814141000_home_solicitation_auto_release.sql",
  "supabase/migrations/20260814142000_home_solicitation_events.sql",
];
for (const path of required) assert.ok(fs.existsSync(path), `Phase 2 artifact missing: ${path}`);
const publicRoute = fs.readFileSync("app/api/contracts/estimate/[token]/route.ts", "utf8");
assert.match(publicRoute, /home.?solicitation/i);
assert.match(publicRoute, /work/i);
console.log("Ohio home-solicitation Phase 2 completeness contract passed.");
