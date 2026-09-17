import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/blueprints/[versionId]/engine-targeted-dedupe-collision-simulation/route.ts", "utf8");

assert.match(route, /assessSourcePixelOverlay/, "targeted de-duplication replay must validate rendered-source pixel fidelity");
assert.match(route, /assessSourceWallNetworkOverlay/, "targeted de-duplication replay must validate independent source-network fidelity");
assert.match(route, /topologyMetrics/, "targeted de-duplication replay must validate topology closure");
assert.match(route, /summarizeSourceBackedShortRunFidelitySimulation/, "targeted de-duplication replay must use the fail-closed full-fidelity summary");
assert.match(route, /familyLayerSafe: simulation\.safeToConsiderPromotion/, "full-fidelity promotion must remain gated by isolated source-family safety");
assert.match(route, /dimensionAssociationCount: candidate\.dimensionEvidence\.associations\.length/, "targeted replay must include dimension associations in the fidelity gate");
assert.match(route, /unresolvedDimensionCount: candidate\.dimensionEvidence\.unresolvedDimensionIds\.length/, "targeted replay must include unresolved dimensions in the fidelity gate");
assert.match(route, /unsupportedHighConfidenceWallCount/, "targeted replay must reject unsupported high-confidence geometry regressions");
assert.match(route, /fidelitySimulation,/, "route response must expose the full-fidelity verdict");
assert.match(route, /writesPerformed: false/, "targeted replay must remain read-only");
assert.match(route, /canonicalGeometryChanged: false/, "targeted replay must not modify canonical geometry");
assert.match(route, /generated3d: false/, "targeted replay must not generate 3D output");

console.log("Blueprint targeted de-duplication full-fidelity route contract passed.");
