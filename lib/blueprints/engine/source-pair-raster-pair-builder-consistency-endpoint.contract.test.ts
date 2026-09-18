import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("app/api/blueprints/[versionId]/engine-pair-builder-consistency-diagnostic/route.ts", "utf8");

assert.match(route, /diagnosePairBuilderConsistencyGaps/, "compact route must invoke the pair-builder consistency diagnostic");
assert.match(route, /stageDiagnostic:\s*stageGap/, "compact route must remain subordinate to proven pair-builder residuals");
assert.match(route, /annotationFilteredSegments:\s*candidate\.annotationFiltered/, "compact route must replay unchanged filtered raster evidence");
assert.match(route, /explicitWallSystems:\s*candidate\.explicitSystems/, "compact route must compare against existing explicit systems");
assert.match(route, /maxDuration\s*=\s*120/, "compact diagnostic must have enough runtime for the canonical A4 read-only audit");
assert.match(route, /writesPerformed:\s*false/, "compact diagnostic must remain read-only");
assert.match(route, /productionPairingChanged:\s*false/, "compact diagnostic must not alter production pairing");
assert.match(route, /sourceSelectionChanged:\s*false/, "compact diagnostic must not alter source selection");
assert.match(route, /canonicalGeometryChanged:\s*false/, "compact diagnostic must not alter canonical geometry");
assert.match(route, /generated3d:\s*false/, "compact diagnostic must not generate 3D");

console.log("Blueprint compact pair-builder consistency endpoint contract passed.");
