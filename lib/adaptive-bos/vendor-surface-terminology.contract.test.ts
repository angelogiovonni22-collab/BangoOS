import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const vendorsPage = readFileSync("app/(app)/vendors/vendors-list-client.tsx", "utf8");
const vendorsRoute = readFileSync("app/(app)/vendors/page.tsx", "utf8");
const adaptiveVendorActions = readFileSync("app/(app)/vendors/adaptive-vendor-actions.tsx", "utf8");
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
assert.match(vendorsTable, /const directoryTitle = isContractorVendor \? t\("navigation\.vendorDirectory"\) : `\$\{vendorLabel\} Directory`/, "Vendor directory title must preserve adaptive terminology outside the localized construction default");
assert.match(vendorsTable, /isContractorVendor \? t\("navigation\.contractorVendorHeading"\) : vendorLabel/, "Vendor table heading must preserve adaptive terminology outside the localized construction default");
assert.doesNotMatch(vendorsTable, /title="Vendor Directory"/, "Vendor table must not hard-code its construction-default directory title");

assert.match(vendorsFilters, /useAdaptiveBos/, "Vendor filters must resolve Adaptive B.O.S. terminology");
assert.match(vendorsFilters, /: `All \$\{vendorsLabel\}`/, "Vendor filter options must preserve adaptive terminology outside the localized construction default");
assert.match(vendorsFilters, /: `\$\{vendorLabel\} code \(A-Z\)`/, "Vendor code sort label must preserve adaptive terminology outside the localized construction default");
assert.doesNotMatch(vendorsFilters, /aria-label="Search vendors"/, "Vendor search must not hard-code vendor terminology");

assert.match(vendorsRoute, /AdaptiveVendorActions/, "Vendor route must delegate industry-sensitive trade partner controls");
assert.match(adaptiveVendorActions, /industryKey !== "construction"/, "Trade partner controls must remain construction-only");
assert.match(adaptiveVendorActions, /Invite Trade Partner/, "Construction runtime must preserve the existing trade partner invitation action");

console.log("Adaptive B.O.S. vendor surface terminology contract passed.");
