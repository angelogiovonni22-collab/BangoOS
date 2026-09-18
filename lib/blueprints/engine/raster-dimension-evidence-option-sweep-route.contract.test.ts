import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/blueprints/[versionId]/engine-benchmark/route.ts", "utf8");
const candidate = readFileSync("lib/blueprints/engine/raster-architectural-candidate.ts", "utf8");

assert.match(route, /dimensionSweep.*===\s*"1"/, "dimension option sweep must be explicitly requested");
assert.match(route, /label-distance-1\.50m/, "sweep must isolate label-distance evidence recovery");
assert.match(route, /ambiguity-gap-0\.04/, "sweep must isolate ambiguity scoring from label distance");
assert.match(route, /dimensionEvidenceOptionSweep,/, "benchmark must expose compact sweep results");
assert.match(candidate, /dimensionEvidenceOptions\?: BosRasterDimensionEvidenceAssociationOptions/, "candidate builder must accept an optional read-only simulation override");
assert.match(candidate, /options: input\.dimensionEvidenceOptions/, "simulation override must remain subordinate to the existing associator");
assert.match(route, /writesPerformed:\s*false/, "dimension sweep must remain read-only");
assert.match(route, /canonicalGeometryChanged:\s*false/, "dimension sweep must not change canonical geometry");
assert.match(route, /generated3d:\s*false/, "dimension sweep must not generate 3D");

console.log("Blueprint raster dimension evidence option sweep route contract passed.");
