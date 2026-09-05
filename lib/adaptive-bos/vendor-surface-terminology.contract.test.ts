import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vendorsPage = readFileSync("app/(app)/vendors/vendors-list-client.tsx", "utf8");
const vendorsTable = readFileSync("components/vendors/vendors-table.tsx", "utf8");
const vendorsFilters = readFileSync("components/vendors/vendors-filters.tsx", "utf8");

assert.match(vendorsPage, /useAdaptiveBos/, "Vendor workspace must resolve Adaptive B.O.S. terminology");
assert.match(vendorsPage, /term\("vendor", "Vendor"\)/, "Vendor workspace must resolve singular vendor terminology");
assert.match(vendorsPage, /term\("vendors", "Vendors"\)/, "Vendor workspace must resolve plural vendor terminology");
assert.match(vendorsPage, /title=\{vendorsLabel\}/, "Vendor page title must use adaptive terminology");
assert.match(vendorsPage, /New \{vendorLabel\}/, "Vendor primary action must use adaptive terminology");
assert.doesNotMatch(vendorsPage, /title="Vendors"/, "Vendor workspace must not hard-code the construction-default title");
assert.doesNotMatch(vendorsPage, />\s*New vendor\s*</, "Vendor workspace must not hard-code its primary action");

assert.match(vendorsTable, /useAdaptiveBos/, "Vendor table must resolve Adaptive B.O.S. terminology");
assert.match(vendorsTable, /title=\{`\$\{vendorLabel\} Directory`\}/, "Vendor directory title must use adaptive terminology");
assert.match(vendorsTable, /<EnterpriseTableHeading>\{vendorLabel\}<\/EnterpriseTableHeading>/, "Vendor table heading must use adaptive terminology");
assert.doesNotMatch(vendorsTable, /title="Vendor Directory"/, "Vendor table must not hard-code its construction-default directory title");

assert.match(vendorsFilters, /useAdaptiveBos/, "Vendor filters must resolve Adaptive B.O.S. terminology");
assert.match(vendorsFilters, /All \{vendorsLabel\}/, "Vendor filter options must use adaptive terminology");
assert.match(vendorsFilters, /\{vendorLabel\} code/, "Vendor code sort label must use adaptive terminology");
assert.doesNotMatch(vendorsFilters, /aria-label="Search vendors"/, "Vendor search must not hard-code vendor terminology");

console.log("Adaptive B.O.S. vendor surface terminology contract passed.");
