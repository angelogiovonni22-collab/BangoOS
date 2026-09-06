import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inventory = readFileSync("app/(app)/inventory/inventory-workspace-client.tsx", "utf8");
const fulfillment = readFileSync("app/(app)/materials/procurement/fulfillment-command-center.tsx", "utf8");
const scheduling = readFileSync("components/scheduling/scheduling-header.tsx", "utf8");
const navigationEn = JSON.parse(readFileSync("locales/en/navigation.json", "utf8")) as Record<string, string>;
const navigationEs = JSON.parse(readFileSync("locales/es/navigation.json", "utf8")) as Record<string, string>;

assert.match(inventory, /useAdaptiveBos/, "Inventory must resolve Adaptive B.O.S. terminology");
assert.match(inventory, /term\("materials", "Materials"\)/, "Inventory must resolve materials terminology");
assert.match(inventory, /term\("projects", "Projects"\)/, "Inventory must resolve project terminology");
assert.match(inventory, /Receive \{materialsLabel\}/, "Inventory receiving action must use adaptive materials terminology");
assert.match(inventory, /\{materialsLabel\} Catalog/, "Inventory catalog action must use adaptive materials terminology");
assert.match(inventory, /Committed to \$\{projectsLabel\.toLowerCase\(\)\}/, "Inventory commitments must use adaptive project terminology");
assert.doesNotMatch(inventory, /Receive Materials/, "Inventory must not hard-code construction materials copy");

assert.match(fulfillment, /useAdaptiveBos/, "Procurement fulfillment must resolve Adaptive B.O.S. terminology");
assert.match(fulfillment, /term\("materials", "Materials"\)/, "Procurement must resolve materials terminology");
assert.match(fulfillment, /term\("vendor", "Supplier"\)/, "Procurement must resolve supplier/vendor terminology");
assert.match(fulfillment, /\{materialsLabel\} Fulfillment Command Center/, "Fulfillment heading must use adaptive materials terminology");
assert.doesNotMatch(fulfillment, /Material Fulfillment Command Center/, "Fulfillment heading must not hard-code Material");

assert.match(scheduling, /useAdaptiveBos/, "Scheduling filters must resolve Adaptive B.O.S. terminology");
assert.match(scheduling, /term\("project", "Project"\)/, "Scheduling must resolve project terminology");
assert.match(scheduling, /term\("workforce", "Workforce"\)/, "Scheduling must resolve workforce terminology");
assert.match(scheduling, /All \{projectsLabel\}/, "Scheduling project filter must use adaptive project terminology");
assert.match(scheduling, /navigation\.allTeams/, "Scheduling team filter must use localized cross-industry team terminology");
assert.match(scheduling, /navigation\.teamMember/, "Scheduling grouping must use localized team-member terminology");
assert.equal(navigationEn.allTeams, "All teams", "English scheduling team filter must remain cross-industry");
assert.equal(navigationEn.team, "Team", "English scheduling team grouping must remain cross-industry");
assert.equal(navigationEn.teamMember, "Team Member", "English scheduling member grouping must remain cross-industry");
assert.equal(navigationEs.allTeams, "Todos los equipos", "Spanish scheduling team filter must be localized");
assert.equal(navigationEs.team, "Equipo", "Spanish scheduling team grouping must be localized");
assert.equal(navigationEs.teamMember, "Miembro del equipo", "Spanish scheduling member grouping must be localized");

console.log("Adaptive B.O.S. final surface terminology contract passed.");
