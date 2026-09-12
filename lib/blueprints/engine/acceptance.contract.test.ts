import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosBuildingGraph } from "./building-graph";
import { evaluateMitchellDewittProductionAcceptance, MITCHELL_DEWITT_PRODUCTION_STANDARD } from "./acceptance";

function provenance(algorithm: string) {
  return { createdBy: "deterministic" as const, algorithm, algorithmVersion: "test", evidenceIds: [] };
}

function passingGraph(): BosBuildingGraph {
  const graph = createEmptyBosBuildingGraph({
    buildingId: "mitchell-test",
    sourcePage: 1,
    sourceSheetNumber: "A4",
    sourceSheetTitle: "First Floor Plan",
  });
  graph.confidence = 0.9;
  graph.scale = { source: "printed", drawingUnitsPerMeter: 100, confidence: 0.98 };

  const wallSegments = [
    [[0, 0], [12, 0]], [[12, 0], [12, 4]], [[12, 4], [10, 4]], [[10, 4], [10, 7]],
    [[10, 7], [6, 7]], [[6, 7], [6, 9]], [[6, 9], [0, 9]], [[0, 9], [0, 0]],
    [[3, 0], [3, 9]], [[6, 0], [6, 7]], [[0, 4], [10, 4]], [[8, 4], [8, 7]],
  ] as const;
  graph.walls = wallSegments.map((segment, index) => ({
    id: `wall-${index}`,
    levelId: "level-1",
    type: index < 8 ? "exterior" as const : "interior" as const,
    centerline: { start: { x: segment[0][0], y: segment[0][1] }, end: { x: segment[1][0], y: segment[1][1] } },
    thickness: 0.15,
    height: 2.7,
    confidence: 0.9,
    sourcePage: 1,
    evidence: [],
    provenance: provenance("test-wall"),
  }));

  const roomNames = ["Living Room", "Kitchen", "Bedroom", "Bathroom", "Hall", "2-CAR GARAGE"];
  graph.rooms = roomNames.map((name, index) => ({
    id: `room-${index}`,
    levelId: "level-1",
    type: "room" as const,
    name,
    polygon: { points: [{ x: index, y: 0 }, { x: index + 0.8, y: 0 }, { x: index + 0.8, y: 0.8 }, { x: index, y: 0.8 }] },
    confidence: 0.9,
    sourcePage: 1,
    evidence: [],
    provenance: provenance("test-room"),
  }));

  graph.openings = Array.from({ length: 6 }, (_, index) => ({
    id: `opening-${index}`,
    levelId: "level-1",
    type: "door" as const,
    wallId: `wall-${index}`,
    offset: 0.5,
    width: 0.9,
    height: 2.0,
    confidence: 0.9,
    sourcePage: 1,
    evidence: [],
    provenance: provenance("test-opening"),
  }));

  graph.stairs = [{
    id: "stair-1", levelId: "level-1", type: "stair", polygon: { points: [{ x: 5, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 5, y: 5 }] },
    confidence: 0.9, sourcePage: 1, evidence: [], provenance: provenance("test-stair"),
  }];
  const deck = {
    id: "deck-1", levelId: "level-1", type: "deck" as const, polygon: { points: [{ x: 3, y: 9 }, { x: 6, y: 9 }, { x: 6, y: 11 }, { x: 3, y: 11 }] },
    thickness: 0.15, elevation: 0, confidence: 0.9, sourcePage: 1, evidence: [], provenance: provenance("test-deck"),
  };
  graph.slabs = [deck, {
    id: "garage-slab", levelId: "level-1", type: "floor" as const, polygon: { points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }] },
    thickness: 0.15, elevation: 0, confidence: 0.9, sourcePage: 1, evidence: [], provenance: provenance("garage-semantic"),
  }];
  graph.decksPorches = [deck];
  graph.validation = {
    version: 1,
    score: 0.9,
    status: "reconstructed",
    metrics: { exteriorClosure: 0.86, footprintComplexity: 0.5, wallTopology: 0.88, scaleConfidence: 0.98, semanticCoverage: 0.8 },
    issues: [],
  };
  return graph;
}

const passing = evaluateMitchellDewittProductionAcceptance(passingGraph());
assert.equal(passing.passed, true, `expected production fixture to pass: ${passing.failures.join(", ")}`);

const wrongSheet = passingGraph();
wrongSheet.metadata.sourceSheetNumber = "A1";
const wrongSheetResult = evaluateMitchellDewittProductionAcceptance(wrongSheet);
assert.equal(wrongSheetResult.passed, false, "The Mitchell acceptance gate must reject the former A1/basement benchmark identity");
assert.equal(wrongSheetResult.checks.legacyBenchmark, false);

const weak = passingGraph();
weak.validation.metrics.exteriorClosure = 0.6;
weak.validation.metrics.wallTopology = 0.7;
weak.validation.status = "needs_review";
weak.rooms = weak.rooms.slice(0, 4);
const rejected = evaluateMitchellDewittProductionAcceptance(weak);
assert.equal(rejected.passed, false);
assert(rejected.failures.includes("wallTopology"));
assert(rejected.failures.includes("exteriorClosure"));
assert(rejected.failures.includes("roomCoverage"));
assert(rejected.failures.includes("reconstructedStatus"));
assert.equal(MITCHELL_DEWITT_PRODUCTION_STANDARD.minValidationScore, 0.82);

console.log("Blueprint production acceptance contract: passed");
