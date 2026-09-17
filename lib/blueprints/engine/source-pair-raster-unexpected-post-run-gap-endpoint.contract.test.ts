import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/blueprints/[versionId]/engine-unexpected-post-run-gap-diagnostic/route.ts", "utf8");

assert.match(route, /diagnoseUnexpectedPostRunGaps/, "endpoint must run the unexpected post-run gap classifier");
assert.match(route, /diagnoseRasterDedupeGaps/, "endpoint must derive candidates from the existing fail-closed raster gap audit");
assert.match(route, /expectedPage/, "endpoint must retain the selected-page guard");
assert.match(route, /writesPerformed: false/, "endpoint must remain read-only");
assert.match(route, /extractionChanged: false/, "endpoint must not modify production extraction");
assert.match(route, /selectorDefaultsChanged: false/, "endpoint must not modify selector defaults");
assert.match(route, /canonicalGeometryChanged: false/, "endpoint must not modify canonical geometry");
assert.match(route, /generated3d: false/, "endpoint must not generate 3D output");

console.log("Blueprint unexpected post-run raster gap endpoint contract passed.");
