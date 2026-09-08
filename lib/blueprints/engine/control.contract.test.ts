import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { replayBosGraphCorrectionsWithConflicts, type BosGraphCorrection } from "./corrections";

const root = process.cwd();
const controlFiles = [
  "README.md",
  "master-plan.md",
  "building-graph-contract.md",
  "benchmark-criteria.md",
  "workstream-boundaries.md",
  "phase-status.md",
  "execution-merge-rules.md",
];
for (const file of controlFiles) {
  const target = path.join(root, "docs/blueprint-engine", file);
  assert(fs.existsSync(target), `Blueprint Engine control document is required: ${file}`);
  assert(fs.readFileSync(target, "utf8").trim().length > 200, `Blueprint Engine control document must not be an empty placeholder: ${file}`);
}

const master = fs.readFileSync(path.join(root, "docs/blueprint-engine/master-plan.md"), "utf8");
const graphContract = fs.readFileSync(path.join(root, "docs/blueprint-engine/building-graph-contract.md"), "utf8");
const benchmark = fs.readFileSync(path.join(root, "docs/blueprint-engine/benchmark-criteria.md"), "utf8");
const phase = fs.readFileSync(path.join(root, "docs/blueprint-engine/phase-status.md"), "utf8");
const mergeRules = fs.readFileSync(path.join(root, "docs/blueprint-engine/execution-merge-rules.md"), "utf8");
assert(master.includes("Phase A") && master.includes("Phase F"), "Blueprint Engine master plan must retain the complete phase sequence");
assert(graphContract.includes("BosBuildingGraph") && graphContract.includes("reconstructed"), "Canonical Building Graph contract must define schema identity and validation semantics");
assert(benchmark.includes("8100 Mitchell Dewitt") && benchmark.includes("four-wall rectangle"), "Permanent Mitchell Dewitt benchmark and rectangle rejection must remain documented");
assert(phase.includes("feat/blueprint-engine-native") && phase.includes("#524"), "Phase status must retain the active branch/PR checkpoint while this release branch is open");
assert(mergeRules.includes("do not merge") || mergeRules.includes("Do not merge"), "Execution rules must forbid merge while required CI is pending or failing");

const graph = createEmptyBosBuildingGraph({ buildingId: "correction-test", sourcePage: 2, sourceSheetTitle: "FIRST FLOOR PLAN" });
const wall: BosWall = {
  id: "wall-level-1-1",
  levelId: "level-1",
  type: "unknown",
  centerline: { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
  thickness: 0.15,
  height: 2.44,
  confidence: 0.9,
  sourcePage: 2,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
};
graph.walls = [wall];
const corrections: BosGraphCorrection[] = [
  { id: "c1", type: "classify_wall", wallId: wall.id, wallType: "exterior", createdAt: "2026-09-08T00:00:00.000Z" },
  { id: "c2", type: "move_wall", wallId: wall.id, start: { x: 1, y: 1 }, end: { x: 5, y: 1 }, createdAt: "2026-09-08T00:00:01.000Z" },
  { id: "c3", type: "move_wall", wallId: "missing-wall", start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, createdAt: "2026-09-08T00:00:02.000Z" },
];
const replayed = replayBosGraphCorrectionsWithConflicts(graph, corrections);
assert.equal(replayed.graph.walls[0].type, "exterior", "Persisted wall classification must replay");
assert.deepEqual(replayed.graph.walls[0].centerline.start, { x: 1, y: 1 }, "Persisted wall geometry correction must replay deterministically");
assert.equal(replayed.graph.walls[0].provenance.createdBy, "manual", "Replayed correction must retain manual provenance");
assert.equal(replayed.conflicts.length, 1, "Missing correction targets must surface as conflicts instead of being silently dropped");
assert.equal(replayed.conflicts[0].objectId, "missing-wall");

console.log("B.O.S. Blueprint Engine control structure and correction replay: PASS");
