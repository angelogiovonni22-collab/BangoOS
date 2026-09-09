import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { solveDimensionScaleCorrection } from "./dimension-solver";
import { mergeCollinearSegments, type BosRawSegment } from "./geometry";
import { extractRasterLineSegments } from "./raster";
import { applyBosValidation } from "./validation";

function wall(id: string, x1: number, y1: number, x2: number, y2: number): BosWall {
  return {
    id,
    levelId: "level-1",
    type: "exterior",
    centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    thickness: 0.1524,
    height: 2.4384,
    confidence: 0.9,
    sourcePage: 1,
    evidence: [],
    provenance: { createdBy: "deterministic", algorithm: "hardening-fixture", algorithmVersion: "1", evidenceIds: [] },
  };
}

async function main() {
  // Sparse-plan fixture: B.O.S. must fail closed instead of promoting a visually plausible box.
  const sparse = createEmptyBosBuildingGraph({ buildingId: "sparse", sourcePage: 1, sourceSheetTitle: "FIRST FLOOR PLAN" });
  sparse.scale = { source: "printed", drawingUnitsPerMeter: 50, confidence: 0.98 };
  sparse.walls = [wall("s1", 0, 0, 10, 0), wall("s2", 10, 0, 10, 8), wall("s3", 10, 8, 0, 8)];
  const sparseValidated = applyBosValidation(sparse);
  assert.notEqual(sparseValidated.validation.status, "reconstructed", "Sparse plans must never become 3D Ready");
  assert(sparseValidated.validation.issues.some((issue) => issue.code === "WALL_UNDERTRACE"), "Sparse-plan withholding must identify wall under-tracing");

  // Conflicting-dimension fixture: two incompatible measurements must not silently rescale geometry.
  const conflicting = createEmptyBosBuildingGraph({ buildingId: "conflicting-dimensions", sourcePage: 1, sourceSheetTitle: "FIRST FLOOR PLAN" });
  conflicting.walls = [wall("dimension-wall-1", 0, 0, 10, 0), wall("dimension-wall-2", 0, 5, 10, 5)];
  conflicting.dimensions = [
    { id: "d1", levelId: "level-1", page: 1, start: { x: 0, y: -0.5 }, end: { x: 10, y: -0.5 }, value: 10.2, unit: "m", confidence: 0.95, evidence: [] },
    { id: "d2", levelId: "level-1", page: 1, start: { x: 0, y: 5.5 }, end: { x: 10, y: 5.5 }, value: 12.2, unit: "m", confidence: 0.95, evidence: [] },
  ];
  const conflictSolve = solveDimensionScaleCorrection(conflicting);
  assert.equal(conflictSolve.conflict, true, "Dimension ratios with >8% spread must surface a conflict");
  assert.equal(conflictSolve.applied, false, "Conflicting dimensions must not alter geometry");
  assert.deepEqual(conflictSolve.graph.walls.map((item) => item.centerline), conflicting.walls.map((item) => item.centerline), "Conflicting-dimension fixture must preserve original wall coordinates");

  // Scanned-plan-like raster fixture: deterministic dark wall runs on a noisy paper background.
  const rasterFixture = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="650" viewBox="0 0 900 650">
  <rect width="900" height="650" fill="#f4f3ef"/>
  <g stroke="#161616" stroke-width="5" fill="none">
    <path d="M90 80 H790 V560 H90 Z"/>
    <path d="M430 80 V560"/>
    <path d="M90 310 H790"/>
  </g>
  <g stroke="#888" stroke-width="1" opacity=".45">
    <path d="M40 40 H160 M710 610 H850 M180 180 H240 M610 160 V220"/>
  </g>
</svg>`);
  const raster = await extractRasterLineSegments(rasterFixture, {
    page: 1,
    drawingUnitsPerMeter: 50,
    sourceWidth: 900,
    sourceHeight: 650,
    options: { minRunPixels: 30, threshold: 190, gapPixels: 4 },
  });
  assert(raster.segments.length >= 6, `Scanned-plan raster fixture should recover major orthogonal wall runs; got ${raster.segments.length}`);
  assert(raster.diagnostics.some((item) => item.includes("normalized to meters")), "Raster benchmark must prove scale-normalized output");

  // Dense-plan performance budget: normalization must remain comfortably interactive on a large vector fixture.
  const dense: BosRawSegment[] = [];
  for (let row = 0; row < 40; row += 1) {
    for (let column = 0; column < 40; column += 1) {
      const x = column * 0.5;
      const y = row * 0.5;
      dense.push({ sourcePage: 1, start: { x, y }, end: { x: x + 0.45, y }, confidence: 0.9 });
      dense.push({ sourcePage: 1, start: { x, y }, end: { x, y: y + 0.45 }, confidence: 0.9 });
    }
  }
  const started = performance.now();
  const denseMerged = mergeCollinearSegments(dense);
  const elapsedMs = performance.now() - started;
  assert(denseMerged.length > 0, "Dense-plan normalization fixture must return geometry");
  assert(elapsedMs < 5000, `Dense-plan vector normalization exceeded the 5s CI budget (${Math.round(elapsedMs)}ms)`);

  console.log(`B.O.S. Blueprint production hardening corpus: PASS (${dense.length} dense segments in ${Math.round(elapsedMs)}ms)`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
