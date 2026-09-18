import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/blueprints/[versionId]/engine-source-family-audit/route.ts", "utf8");
const diagnostic = readFileSync("lib/blueprints/engine/source-pair-raster-pair-builder-consistency-diagnostic.ts", "utf8");

assert.match(route, /diagnosePairBuilderConsistencyGaps/, "source-family audit must invoke the pair-builder consistency diagnostic");
assert.match(route, /stageDiagnostic:\s*noMatchingRasterStageDiagnostic/, "diagnostic must remain subordinate to proven pair-builder consistency residuals");
assert.match(route, /annotationFilteredSegments:\s*architecturalCandidate\.annotationFiltered/, "diagnostic must replay the unchanged filtered raster evidence");
assert.match(route, /explicitWallSystems:\s*architecturalCandidate\.explicitSystems/, "diagnostic must compare against existing explicit systems");
assert.match(route, /pairBuilderConsistencyDiagnostic,/, "source-family audit must return the diagnostic");
assert.match(diagnostic, /safeToConsiderPromotion:\s*false/, "pair-builder consistency audit must fail closed");
assert.match(diagnostic, /no pairing rule, selector default, wall, persistence, canonical geometry, or 3D output changed/, "diagnostic must remain read-only");
assert.match(route, /writesPerformed:\s*false/, "audit route must not write");
assert.match(route, /sourceSelectionChanged:\s*false/, "audit route must not change source selection");
assert.match(route, /canonicalGeometryChanged:\s*false/, "audit route must not change canonical geometry");
assert.match(route, /generated3d:\s*false/, "audit route must not generate 3D");

console.log("Blueprint raster pair-builder consistency route contract passed.");
