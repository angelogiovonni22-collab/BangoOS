import assert from "node:assert/strict";
import "./downstream-intelligence.contract.test";
import { createEmptyBosBuildingGraph, type BosBuildingGraph } from "./building-graph";
import { buildBosBuildingGraphGlb } from "./graph-to-glb";
import { buildBosBuildingGraphIfc } from "./graph-to-ifc";
import { assembleValidatedMultiFloorGraph, discoverBlueprintLevelSheets, selectMultiFloorLevel } from "./multi-floor-orchestration";

const discovered = discoverBlueprintLevelSheets([
  { sheetId: "s1", versionId: "v1", sheetNumber: "A1.1", title: "Existing First Floor Plan", discipline: "Architectural" },
  { sheetId: "s2", versionId: "v2", sheetNumber: "A1.2", title: "Existing Second Floor Plan", discipline: "Architectural" },
  { sheetId: "s3", versionId: "v3", sheetNumber: "A3.1", title: "Roof Plan", discipline: "Architectural" },
  { sheetId: "s4", versionId: "v4", sheetNumber: "S1.0", title: "Foundation Plan", discipline: "Structural" },
]);

assert.equal(discovered.length, 2, "Only architectural floor-level sheets should be promoted into multi-floor candidates");
assert.deepEqual(discovered.map((item) => item.levelIndex), [0, 1]);
assert.equal(discovered[1].elevation, 3.048, "Default level spacing should remain deterministic at ten feet when no explicit elevation is registered");

function graph(id: string, yOffset: number): BosBuildingGraph {
  const value = createEmptyBosBuildingGraph({ buildingId: id, sourcePage: 2, levelName: "Temporary" });
  value.walls = [
    [[0, 0], [8, 0]],
    [[8, 0], [8, 5]],
    [[8, 5], [0, 5]],
    [[0, 5], [0, 0]],
    [[0, 2.5], [8, 2.5]],
    [[4, 0], [4, 5]],
    [[2, 0], [2, 2.5]],
    [[6, 2.5], [6, 5]],
  ].map((points, index) => ({
    id: `${id}-wall-${index + 1}`,
    levelId: "level-1",
    type: index < 4 ? "exterior" as const : "interior" as const,
    centerline: { start: { x: points[0][0], y: points[0][1] + yOffset }, end: { x: points[1][0], y: points[1][1] + yOffset } },
    thickness: 0.1524,
    height: 2.4384,
    confidence: 0.94,
    sourcePage: 2,
    evidence: [],
    provenance: { createdBy: "deterministic" as const, algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
  }));
  value.confidence = 0.91;
  value.validation = {
    version: 1,
    score: 0.9,
    status: "reconstructed",
    metrics: { exteriorClosure: 1, footprintComplexity: 0.4, wallTopology: 0.8, scaleConfidence: 0.98, semanticCoverage: 0.6 },
    issues: [],
  };
  return value;
}

const assembly = assembleValidatedMultiFloorGraph([
  { graph: graph("first", 0), candidate: discovered[0] },
  { graph: graph("second", 0.2), candidate: discovered[1] },
]);
assert.equal(assembly.graph.levels.length, 2, "Two discovered floors must assemble into one Building Graph");
assert.equal(assembly.graph.walls.length, 16, "Per-level wall geometry must be preserved in the assembled graph");
assert.equal(assembly.alignmentValidation.valid, true, "Small centroid alignment corrections should pass the multi-floor validation gate");
assert(assembly.graph.levels.every((level) => level.sourceSheetNumber && level.sourceSheetTitle), "Every assembled level must retain source-sheet provenance");
assert.equal(assembly.graph.reconstructionVersion, "native-multifloor-1");

const glb = buildBosBuildingGraphGlb(assembly.graph);
assert.equal(glb.subarray(0, 4).toString("ascii"), "glTF", "Multi-level Building Graph must serialize to GLB");
const jsonLength = glb.readUInt32LE(12);
const glbJson = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8").trim());
const nodeElevations = glbJson.nodes.map((node: { translation: number[] }) => node.translation[1]);
assert(nodeElevations.some((value: number) => value > 3), "Upper-floor GLB wall nodes must include their level elevation");

const ifc = buildBosBuildingGraphIfc(assembly.graph);
assert.equal((ifc.match(/IFCBUILDINGSTOREY\(/g) || []).length, 2, "Multi-level IFC must emit one building storey per discovered level");
assert(ifc.includes("First Floor") && ifc.includes("Second Floor"), "IFC level names must preserve discovered floor semantics");

const secondOnly = selectMultiFloorLevel(assembly.graph, "level-2");
assert.equal(secondOnly.levels.length, 1);
assert(secondOnly.walls.every((wall) => wall.levelId === "level-2"), "Level controls must be able to isolate one floor without changing the canonical full graph");

console.log("B.O.S. Blueprint multi-floor orchestration contract: PASS");
