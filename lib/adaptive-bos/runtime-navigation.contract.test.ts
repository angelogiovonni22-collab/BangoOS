import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "app/(app)/app-shell.tsx"), "utf8");

assert(source.includes('useAdaptiveBos'), "App shell must consume Adaptive B.O.S. runtime context");
assert(source.includes('NAV_MODULE_BY_KEY'), "Navigation must map B.O.S. routes to adaptive modules");
assert(source.includes('hasModule(moduleKey)'), "Navigation must hide modules disabled by the operating profile");
assert(source.includes('moduleForPath(pathname)'), "Direct navigation must resolve the active adaptive module");
assert(source.includes('router.replace(homePath)'), "Disabled modules must fail closed to the authorized home workspace");
assert(source.includes('ADAPTIVE_TERM_BY_NAV_KEY'), "Navigation must support industry-aware terminology");
assert(source.includes('getNavigationLabel(item.key, t, term)'), "Sidebar and top navigation must render adaptive terminology");
assert(source.includes('projects: "projects"'));
assert(source.includes('estimates: "estimates"'));
assert(source.includes('customers: "customers"'));
assert(source.includes('materials: "materials"'));
assert(source.includes('equipment: "equipment"'));
assert(source.includes('vendors: "vendors"'));

console.log("Adaptive B.O.S. runtime navigation contract passed");
