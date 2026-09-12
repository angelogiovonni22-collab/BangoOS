import assert from "node:assert/strict";
import type { BosClassifiedPrimitive } from "./primitive-classifier";
import type { BosPdfVectorPrimitive } from "./plan-parser";
import { buildWallSystemsFromClassifiedPrimitives } from "./wall-system-builder";

function linePrimitive(id: string, y: number, x1 = 0, x2 = 200): BosPdfVectorPrimitive {
  return {
    id,
    page: 1,
    lineWidth: 0.8,
    commands: [
      { kind: "moveTo", point: { x: x1, y } },
      { kind: "lineTo", point: { x: x2, y } },
    ],
  };
}

function classified(
  primitive: BosPdfVectorPrimitive,
  classification: BosClassifiedPrimitive["classification"] = "wall_face",
  confidence = 0.9,
): BosClassifiedPrimitive {
  return { primitive, classification, confidence, reasons: ["contract fixture"] };
}

const faceA = classified(linePrimitive("face-a", 0));
const faceB = classified(linePrimitive("face-b", 10));
const unrelatedParallel = classified(linePrimitive("orphan", 80, 20, 180));
const dimension = classified(linePrimitive("dimension", 20), "dimension_line", 0.95);

const systems = buildWallSystemsFromClassifiedPrimitives(
  [faceA, faceB, unrelatedParallel, dimension],
  { drawingUnitsPerMeter: 100 },
);

assert.equal(systems.length, 1, "A two-face wall must produce exactly one wall system and single faces must not become walls");
const wall = systems[0];
assert.ok(Math.abs(wall.thickness - 0.1) < 1e-9, "Wall thickness must come from face separation");
assert.ok(Math.abs(wall.length - 2) < 1e-9, "Wall length must come from the paired overlap");
assert.deepEqual(wall.centerline.start, { x: 0, y: 0.05 });
assert.deepEqual(wall.centerline.end, { x: 2, y: 0.05 });
assert.equal(wall.faceA.primitiveId, "face-a");
assert.equal(wall.faceB.primitiveId, "face-b");
assert.equal(wall.overlapRatio, 1);
assert.ok(wall.confidence >= 0.7);

const noScale = buildWallSystemsFromClassifiedPrimitives([faceA, faceB], { drawingUnitsPerMeter: 0 });
assert.deepEqual(noScale, [], "Unknown/invalid scale must fail closed rather than invent wall geometry");

const singleFace = buildWallSystemsFromClassifiedPrimitives([faceA], { drawingUnitsPerMeter: 100 });
assert.deepEqual(singleFace, [], "A single wall face is evidence, not a complete wall system");

console.log("wall system builder contract passed");
