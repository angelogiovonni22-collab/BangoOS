import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) { passed += 1; console.log(`  + ${message}`); }
  else { failed += 1; console.error(`  x FAIL: ${message}`); }
}

const root = process.cwd();
const route = readFileSync(join(root, "app", "api", "settings", "reviewer-invite", "route.ts"), "utf8");
const page = readFileSync(join(root, "app", "(app)", "settings", "reviewer-access", "page.tsx"), "utf8");

console.log("\nReviewer access security contract");
check(route.includes("requireCompanyAdmin"), "only company Owner/Administrator can create reviewer access");
check(route.includes('role: "employee"'), "reviewer uses the constrained employee role rather than privileged roles");
check(route.includes('"projects.manage": false'), "project mutation is explicitly denied");
check(route.includes('"daily_reports.manage": false'), "daily report mutation is explicitly denied");
check(route.includes('"photos.manage": false'), "photo uploads are explicitly denied");
check(route.includes('"communications.manage": false'), "sending communication is explicitly denied");
check(route.includes('"project_financials.view": false'), "project financials are denied");
check(route.includes('"customers.view": false'), "customer directory is denied");
check(route.includes('"estimates.view": false'), "estimates are denied");
check(route.includes('"invoices.view": false'), "invoices are denied");
check(route.includes('"workforce.view": false'), "workforce records are denied");
check(route.includes('"vendors.view": false'), "vendor records are denied");
check(route.includes('"settings.view": false'), "settings are denied");
check(route.includes('"access_control.manage": false'), "access control is denied");
check(route.includes('"orion.use": false'), "Orion access is denied");
check(route.includes("REVIEWER_SAFE_EXISTING_ROLES"), "existing privileged memberships cannot be silently downgraded");
check(route.includes("inviteUserByEmail"), "reviewer receives a dedicated Supabase invitation rather than shared owner credentials");
check(page.includes("Never share your owner password"), "reviewer setup warns against sharing the owner account");
check(page.includes("read-only"), "reviewer UI clearly states the read-only boundary");

console.log(`\nReviewer access contract results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
