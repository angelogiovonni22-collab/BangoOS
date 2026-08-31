import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const formField = readFileSync(resolve(root, "components/ui/form-field.tsx"), "utf8");
const portal = readFileSync(resolve(root, "app/(app)/customer-portal/page.tsx"), "utf8");
const accessControl = readFileSync(resolve(root, "app/(app)/settings/access-control/page.tsx"), "utf8");

assert.match(formField, /useId\(\)/, "shared form fields should create a stable control id when callers omit one");
assert.match(formField, /<FormLabel htmlFor=\{controlId\}/, "shared form labels should target the associated control");
assert.match(formField, /"aria-invalid": true/, "field errors should be exposed to assistive technology");
assert.match(formField, /"aria-describedby"/, "field errors should describe their associated control");

assert.doesNotMatch(portal, /grid-cols-3[\s\S]*Photos[\s\S]*Updates[\s\S]*Messages/, "customer portal must not display non-working feature tiles");
assert.match(portal, /Ask your construction company&apos;s B\.O\.S\. administrator to link this login/, "unlinked customer accounts should receive actionable guidance");
assert.match(accessControl, /Required for this login to see projects assigned to the customer profile/, "administrators should see the customer-link requirement where they can fix it");
assert.match(accessControl, /Required for this login to see assigned Trade Partner work/, "administrators should see the vendor-link requirement where they can fix it");

console.log("launch workflow clarity contract passed");
