import assert from "node:assert/strict";
import { summarizeSourceBackedShortRunFidelitySimulation } from "./source-backed-shortrun-fidelity-simulation";

const baseline = {
  wallCount: 70,
  preselectionWallCount: 290,
  predictedPrecision: 0.98,
  sourceWallFaceRecall: 0.92,
  sourceNetworkRecall: 0.90,
  preselectionSourceNetworkRecall: 0.967,
  topologyClosure: 0.5,
  unsupportedHighConfidenceWallCount: 0,
  dimensionAssociationCount: 8,
  unresolvedDimensionCount: 10,
};

const safe = summarizeSourceBackedShortRunFidelitySimulation({
  familyLayerSafe: true,
  baseline,
  simulated: {
    ...baseline,
    preselectionWallCount: 292,
    sourceWallFaceRecall: 0.925,
    sourceNetworkRecall: 0.905,
    preselectionSourceNetworkRecall: 0.969,
  },
});
assert.equal(safe.safeToConsiderFidelityPromotion, true);
assert.equal(safe.regressions.length, 0);
assert.equal(safe.evidenceImproved, true);

const regressive = summarizeSourceBackedShortRunFidelitySimulation({
  familyLayerSafe: true,
  baseline,
  simulated: {
    ...baseline,
    sourceNetworkRecall: 0.91,
    topologyClosure: 0.49,
  },
});
assert.equal(regressive.safeToConsiderFidelityPromotion, false);
assert.deepEqual(regressive.regressions, ["topology_closure"]);

const noIndependentGain = summarizeSourceBackedShortRunFidelitySimulation({
  familyLayerSafe: true,
  baseline,
  simulated: { ...baseline, wallCount: 71 },
});
assert.equal(noIndependentGain.safeToConsiderFidelityPromotion, false);
assert.equal(noIndependentGain.evidenceImproved, false);

console.log("Blueprint source-backed short-run fidelity simulation contract passed.");
