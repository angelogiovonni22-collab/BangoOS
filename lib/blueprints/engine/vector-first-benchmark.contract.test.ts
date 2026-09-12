import assert from "node:assert/strict";
import type { BosParsedPlan, BosPdfVectorPrimitive } from "./plan-parser";
import { evaluateVectorFirstCandidatePlan } from "./vector-first-benchmark";

function primitive(id: string, y: number): BosPdfVectorPrimitive {
  return {
    id,
    page: 1,
    lineWidth: 0.5,
    commands: [
      { kind: "moveTo", point: { x: 0, y } },
      { kind: "lineTo", point: { x: 200, y } },
    ],
  };
}

const plan: BosParsedPlan = {
  sourceType: "pdf",
  selectedPage: 1,
  targetScore: 0.99,
  targetEvidence: [],
  pages: [{
    pageNumber: 1,
    width: 500,
    height: 700,
    text: [{ text: `1/4" = 1'-0"`, page: 1, x: 20, y: 20, width: 70, height: 10 }],
    vectorSegments: [
      { start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, sourcePage: 1, sourceObjectId: "face-a", strokeWidth: 0.5, confidence: 0.96 },
      { start: { x: 0, y: 12 }, end: { x: 200, y: 12 }, sourcePage: 1, sourceObjectId: "face-b", strokeWidth: 0.5, confidence: 0.96 },
    ],
    vectorPrimitives: [primitive("face-a", 0), primitive("face-b", 12)],
    rasterRequired: false,
  }],
};

const report = evaluateVectorFirstCandidatePlan(plan, { expectedPage: 1 });
assert.equal(report.selectedPage, 1, "candidate benchmark must preserve the selected physical PDF page");
assert(report.scale.drawingUnitsPerMeter && report.scale.drawingUnitsPerMeter > 0, "candidate benchmark must require a verified printed scale before reconstructing walls");
assert.equal(report.primitiveClasses.wall_face, 2, "two substantial parallel source primitives must remain wall-face evidence");
assert.equal(report.wallSystemCount, 1, "two source wall faces must produce one explicit wall system");
assert.equal(report.constrainedWallSystemCount, 1, "global constraint solving must preserve the supported wall system");
assert.equal(report.wallFacePrimitiveCoverage, 1, "both classified wall-face primitives must retain wall-system provenance");
assert.equal(report.unsupportedGeometryCount, 0, "the benchmark must not invent unsupported wall geometry");
assert(report.sourceAlignment.score > 0.85, "wall centerline must remain closely aligned to its source wall faces");
assert.equal(report.acceptance.checks.targetPage, true, "the expected page identity must be part of acceptance");
assert.equal(report.acceptance.passed, false, "a trivial one-wall fixture must fail the minimum architectural reconstruction gate");
assert.equal(report.acceptance.checks.minimumWallSystems, false, "benchmark acceptance must fail closed when too little architecture is reconstructed");

console.log("Blueprint vector-first candidate benchmark contract passed.");
