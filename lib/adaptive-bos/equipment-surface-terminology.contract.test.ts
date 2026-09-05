import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const equipmentPage = readFileSync("app/(app)/equipment/equipment-list-client.tsx", "utf8");
const equipmentFilters = readFileSync("components/equipment/equipment-filters.tsx", "utf8");
const equipmentTable = readFileSync("components/equipment/equipment-table.tsx", "utf8");

assert.match(equipmentPage, /useAdaptiveBos/, "Equipment workspace must resolve Adaptive B.O.S. terminology");
assert.match(equipmentPage, /term\("equipment", "Equipment"\)/, "Equipment workspace must resolve its industry-specific label");
assert.match(equipmentPage, /title=\{`\$\{equipmentLabel\} Intelligence`\}/, "Equipment page title must use adaptive terminology");
assert.match(equipmentPage, /New \{equipmentLabel\}/, "Equipment primary action must use adaptive terminology");
assert.match(equipmentPage, /No \{equipmentLabel\.toLowerCase\(\)\} yet/, "Equipment empty state must use adaptive terminology");
assert.match(equipmentPage, /Orion \{equipmentLabel\} Brief/, "Orion equipment brief must use adaptive terminology");
assert.doesNotMatch(equipmentPage, /title="Equipment & Fleet Intelligence"/, "Equipment page must not hard-code the construction fleet title");

assert.match(equipmentFilters, /useAdaptiveBos/, "Equipment filters must resolve Adaptive B.O.S. terminology");
assert.match(equipmentFilters, /term\("project", "Project"\)/, "Equipment filters must resolve project terminology");
assert.match(equipmentFilters, /term\("vendor", "Vendor"\)/, "Equipment filters must resolve vendor terminology");
assert.match(equipmentFilters, /All \{projectsLabel\}/, "Equipment project filter must use adaptive plural project terminology");
assert.match(equipmentFilters, /All \{vendorsLabel\}/, "Equipment vendor filter must use adaptive plural vendor terminology");
assert.match(equipmentFilters, /Assigned Team Member/, "Equipment assignments must use cross-industry team-member terminology");
assert.doesNotMatch(equipmentFilters, />Assigned Employee</, "Equipment filters must not expose fixed employee terminology");

assert.match(equipmentTable, /useAdaptiveBos/, "Equipment directory must resolve Adaptive B.O.S. terminology");
assert.match(equipmentTable, /\{equipmentLabel\} Directory/, "Equipment directory heading must use adaptive terminology");
assert.match(equipmentTable, /Current \{projectLabel\}/, "Equipment directory must use adaptive project terminology");
assert.match(equipmentTable, /Assigned Team Member/, "Equipment directory must use cross-industry team-member terminology");
assert.match(equipmentTable, /View \$\{equipmentLabel\}/, "Equipment row actions must use adaptive terminology");
assert.match(equipmentTable, /Edit \$\{equipmentLabel\}/, "Equipment edit actions must use adaptive terminology");

console.log("Adaptive B.O.S. equipment surface terminology contract passed.");
