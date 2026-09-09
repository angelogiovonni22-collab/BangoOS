import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosBuildingGraph, type BosWall } from "./building-graph";
import { buildBosBuildingGraphIfc } from "./graph-to-ifc";
import {
  buildBlueprintCostingIntegration,
  buildRealityEngineAlignmentContract,
  deriveValidatedBlueprintQuantities,
  queryBuildingGraph,
  summarizeBuildingGraphForOrion,
  validateBosIfcCoordinationExport,
} from "./downstream-intelligence";

function validatedGraph(): BosBuildingGraph {
  const graph = createEmptyBosBuildingGraph({ buildingId: "downstream-house", sourcePage: 2, levelName: "First Floor", sourceSheetNumber: "A1.1", sourceSheetTitle: "FIRST FLOOR PLAN" });
  graph.building.sourceVersionId = "version-1";
  graph.levels[0].sourceSheetNumber = "A1.1";
  graph.levels[0].sourceSheetTitle = "FIRST FLOOR PLAN";
  const wall = (id: string, x1: number, y1: number, x2: number, y2: number, type: BosWall["type"]): BosWall => ({
    id,
    levelId: "level-1",
    type,
    centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    thickness: 0.1524,
    height: 2.4384,
    confidence: 0.95,
    sourcePage: 2,
    evidence: [],
    provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
  });
  graph.walls = [
    wall("w1", 0, 0, 10, 0, "exterior"),
    wall("w2", 10, 0, 10, 8, "exterior"),
    wall("w3", 10, 8, 0, 8, "exterior"),
    wall("w4", 0, 8, 0, 0, "exterior"),
    wall("w5", 5, 0, 5, 8, "interior"),
  ];
  graph.rooms = [
    { id: "room-garage", levelId: "level-1", type: "room", name: "Garage", polygon: { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 8 }, { x: 0, y: 8 }] }, area: 40, confidence: 0.94, sourcePage: 2, evidence: [], provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] } },
    { id: "room-living", levelId: "level-1", type: "room", name: "Living Room", polygon: { points: [{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 5, y: 8 }] }, area: 40, confidence: 0.94, sourcePage: 2, evidence: [], provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] } },
  ];
  graph.stairs = [{ id: "stair-1", levelId: "level-1", type: "stair", polygon: { points: [{ x: 4, y: 3 }, { x: 6, y: 3 }, { x: 6, y: 5 }, { x: 4, y: 5 }] }, direction: "up", confidence: 0.9, sourcePage: 2, evidence: [], provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] } }];
  graph.doors = [{ id: "door-1", levelId: "level-1", type: "door", wallId: "w1", offset: 2, width: 0.9, height: 2.03, confidence: 0.9, sourcePage: 2, evidence: [], provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] } }];
  graph.windows = [{ id: "window-1", levelId: "level-1", type: "window", wallId: "w2", offset: 3, width: 1.2, height: 1.2, sillHeight: 0.9, confidence: 0.9, sourcePage: 2, evidence: [], provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] } }];
  graph.openings = [...graph.doors, ...graph.windows];
  graph.confidence = 0.92;
  graph.validation = { version: 1, score: 0.91, status: "reconstructed", metrics: { exteriorClosure: 1, footprintComplexity: 0.4, wallTopology: 0.9, scaleConfidence: 0.98, semanticCoverage: 0.8 }, issues: [] };
  return graph;
}

const graph = validatedGraph();
const summary = summarizeBuildingGraphForOrion(graph);
assert.equal(summary.counts.walls, 5);
assert.equal(summary.counts.rooms, 2);
assert(summary.roomNames.includes("Garage"), "Orion summary must expose evidence-backed room names");

const garageQuery = queryBuildingGraph(graph, { objectType: "room", roomName: "garage" });
assert.equal(garageQuery.length, 1, "Orion graph query helper must support room-name filtering");
const wallQuery = queryBuildingGraph(graph, { objectType: "wall", levelId: "level-1" });
assert.equal(wallQuery.length, 5, "Orion graph query helper must preserve level scope");

const quantities = deriveValidatedBlueprintQuantities(graph);
assert.equal(quantities.find((item) => item.key === "exterior-wall-length")?.quantity, 36);
assert.equal(quantities.find((item) => item.key === "interior-wall-length")?.quantity, 8);
assert.equal(quantities.find((item) => item.key === "room-floor-area")?.quantity, 80);
assert.equal(quantities.find((item) => item.key === "door-count")?.quantity, 1);
assert(quantities.every((item) => item.sourceObjectIds.length > 0), "Derived takeoff quantities must retain their source Building Graph object IDs");

const costing = buildBlueprintCostingIntegration(graph);
assert.equal(costing.pricingStatus, "unpriced", "Building Graph quantities must never invent unit prices");
assert.equal(costing.requiresCostCodeSelection, true, "Job-cost integration must retain existing cost-code review instead of auto-posting geometry to finance");
assert(costing.quantities.every((item) => item.eligibleCostCategories.includes("materials")), "Derived quantities must be compatible with existing Blueprint materials classification without bypassing classification controls");

const reality = buildRealityEngineAlignmentContract(graph);
assert.equal(reality.blueprintVersionId, "version-1");
assert.equal(reality.coordinateSystem, "bos-plan-meters");
assert(reality.anchors.some((anchor) => anchor.type === "stair"), "Reality Engine alignment contract should expose stair anchors when the source graph contains them");

const ifc = buildBosBuildingGraphIfc(graph);
const ifcValidation = validateBosIfcCoordinationExport(ifc, graph);
assert.equal(ifcValidation.valid, true, `Native IFC coordination export must pass internal reference/schema checks: ${ifcValidation.issues.join(" ")}`);
assert(ifcValidation.entityCount > 10);

const unsafe = validatedGraph();
unsafe.validation = { ...unsafe.validation, status: "needs_review", score: 0.65 };
assert.throws(() => deriveValidatedBlueprintQuantities(unsafe), /require a reconstructed Building Graph/i, "Downstream quantity derivation must fail closed when geometry is not validated");
assert.throws(() => buildRealityEngineAlignmentContract(unsafe), /require a reconstructed Building Graph/i, "Reality alignment must fail closed when geometry is not validated");

console.log("B.O.S. Blueprint downstream intelligence contract: PASS");
