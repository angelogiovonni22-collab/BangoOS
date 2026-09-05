import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const server = fs.readFileSync(path.join(root, "lib/adaptive-bos/server.ts"), "utf8");
const layout = fs.readFileSync(path.join(root, "app/(app)/layout.tsx"), "utf8");
const api = fs.readFileSync(path.join(root, "app/api/adaptive-bos/profile/route.ts"), "utf8");

assert(server.includes('from("bos_industry_templates")'), "Adaptive B.O.S. must load canonical industry templates from the database");
assert(server.includes('.eq("status", "active")'), "Inactive industry templates must never drive tenant runtime configuration");
assert(server.includes("templateLabels"), "Database terminology must participate in runtime configuration");
assert(server.includes("templateModules"), "Database module configuration must participate in runtime configuration");
assert(server.includes("templateWorkflowHints"), "Database workflow hints must participate in runtime configuration");
assert(server.includes("profile?.terminologyOverrides"), "Company terminology overrides must remain authoritative over template defaults");
assert(server.includes("profile?.moduleOverrides"), "Company module overrides must remain authoritative over template defaults");
assert(server.includes("profile?.workflowOverrides"), "Company workflow overrides must remain authoritative over template defaults");
assert(layout.includes("resolveAdaptiveBosConfigFromDatabase"), "Authenticated B.O.S. shell must use database-backed industry templates");
assert(api.includes("resolveAdaptiveBosConfigFromDatabase"), "Operating profile API must return the same database-backed runtime configuration as the shell");
assert(!server.includes("service_role"), "Adaptive B.O.S. runtime must not embed service-role credentials");

console.log("Adaptive B.O.S. database template runtime contract passed");
