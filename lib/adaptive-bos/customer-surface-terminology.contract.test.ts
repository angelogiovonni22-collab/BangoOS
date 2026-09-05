import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const customersPage = readFileSync("app/(app)/customers/page.tsx", "utf8");
const customerTable = readFileSync("components/customers/customer-table.tsx", "utf8");

assert.match(customersPage, /useAdaptiveBos/, "Customers workspace must resolve Adaptive B.O.S. terminology");
assert.match(customersPage, /term\("customer", "Customer"\)/, "Customers workspace must resolve singular customer terminology");
assert.match(customersPage, /term\("customers", "Customers"\)/, "Customers workspace must resolve plural customer terminology");
assert.match(customersPage, /title=\{customersLabel\}/, "Customers page title must use adaptive terminology");
assert.match(customersPage, /New \{customerLabel\}/, "Customers primary action must use adaptive terminology");
assert.match(customersPage, /aria-label=\{`\$\{customerLabel\} summary filters`\}/, "Customer summary filters must expose the adaptive noun");
assert.doesNotMatch(customersPage, /title="Customers"/, "Customers page must not hard-code the construction-default page title");
assert.doesNotMatch(customersPage, /description="Manage residential, commercial, and property management customers\."/, "Customers page must not expose construction-specific description copy");

assert.match(customerTable, /useAdaptiveBos/, "Customer table must resolve Adaptive B.O.S. terminology");
assert.match(customerTable, /Create \{estimateLabel\}/, "Customer actions must adapt estimate terminology");
assert.match(customerTable, /Create \{projectLabel\}/, "Customer actions must adapt project terminology");
assert.match(customerTable, /View \{customerLabel\}/, "Customer actions must adapt customer terminology");
assert.match(customerTable, /Archive \{customerLabel\}/, "Customer lifecycle actions must adapt customer terminology");
assert.doesNotMatch(customerTable, />View Customer</, "Customer action menu must not hard-code Customer");
assert.doesNotMatch(customerTable, />Create Estimate</, "Customer action menu must not hard-code Estimate");
assert.doesNotMatch(customerTable, />Create Project</, "Customer action menu must not hard-code Project");

console.log("Adaptive B.O.S. customer surface terminology contract passed.");
