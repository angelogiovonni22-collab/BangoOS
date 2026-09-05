import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const materialsPage = readFileSync("app/(app)/materials/materials-list-client.tsx", "utf8");
const materialsTable = readFileSync("components/materials/materials-table.tsx", "utf8");

assert.match(materialsPage, /useAdaptiveBos/, "Materials workspace must resolve Adaptive B.O.S. terminology");
assert.match(materialsPage, /term\("materials", "Materials"\)/, "Materials workspace must resolve its industry-specific label");
assert.match(materialsPage, /term\("procurement", "Procurement"\)/, "Materials workspace must resolve procurement terminology");
assert.match(materialsPage, /term\("vendor", "Vendor"\)/, "Materials workspace must resolve vendor terminology");
assert.match(materialsPage, /eyebrow=\{materialsLabel\}/, "Materials page eyebrow must use adaptive terminology");
assert.match(materialsPage, /title=\{`\$\{materialsLabel\} Management`\}/, "Materials page title must use adaptive terminology");
assert.match(materialsPage, /\{vendorLabel\} Price Lists/, "Supplier price-list action must use adaptive vendor terminology");
assert.match(materialsPage, /\{procurementLabel\} Workflow/, "Procurement action must use adaptive terminology");
assert.doesNotMatch(materialsPage, /title="Materials Management"/, "Materials workspace must not hard-code the construction-default title");
assert.doesNotMatch(materialsPage, /eyebrow="Materials"/, "Materials workspace must not hard-code the construction-default eyebrow");
assert.doesNotMatch(materialsPage, />Procurement Workflow</, "Materials workspace must not hard-code procurement action copy");

assert.match(materialsTable, /useAdaptiveBos/, "Materials catalog must resolve Adaptive B.O.S. terminology");
assert.match(materialsTable, /term\("materials", "Materials"\)/, "Materials catalog must resolve its industry-specific label");
assert.match(materialsTable, /term\("vendor", "Vendor"\)/, "Materials catalog must resolve vendor terminology");
assert.match(materialsTable, /title=\{`\$\{materialsLabel\} Catalog`\}/, "Materials catalog title must use adaptive terminology");
assert.match(materialsTable, /Preferred \{vendorLabel\}/, "Preferred vendor heading must use adaptive terminology");
assert.doesNotMatch(materialsTable, /title="Materials Catalog"/, "Materials catalog must not hard-code its construction-default title");
assert.doesNotMatch(materialsTable, />Material</, "Materials table must not hard-code a singular construction-default item heading");

console.log("Adaptive B.O.S. materials surface terminology contract passed.");
