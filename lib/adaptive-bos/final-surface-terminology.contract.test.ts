import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const inventory = readFileSync("app/(app)/inventory/inventory-workspace-client.tsx", "utf8");
const fulfillment = readFileSync("app/(app)/materials/procurement/fulfillment-command-center.tsx", "utf8");
const scheduling = readFileSync("components/scheduling/scheduling-header.tsx", "utf8");

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
assert.match(scheduling, />All teams</, "Scheduling team filter must avoid construction-only crew wording");
assert.match(scheduling, />Team Member</, "Scheduling grouping must use cross-industry team-member terminology");

console.log("Adaptive B.O.S. final surface terminology contract passed.");
