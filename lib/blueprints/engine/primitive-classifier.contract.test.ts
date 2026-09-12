import assert from "node:assert/strict";
import type { BosPdfVectorPrimitive } from "./plan-parser";
import { classifyArchitecturalPrimitives, summarizePrimitiveClasses } from "./primitive-classifier";

function primitive(id: string, commands: BosPdfVectorPrimitive["commands"], lineWidth = 0.5, dashArray?: number[]): BosPdfVectorPrimitive {
  return { id, page: 1, commands, lineWidth, dashArray };
}

const wall = primitive("wall-face", [
  { kind: "moveTo", point: { x: 10, y: 100 } },
  { kind: "lineTo", point: { x: 180, y: 100 } },
], 1.2);

const witness = primitive("dimension-witness", [
  { kind: "moveTo", point: { x: 95, y: 45 } },
  { kind: "lineTo", point: { x: 95, y: 75 } },
], 0.35);

const dimension = primitive("dimension-line", [
  { kind: "moveTo", point: { x: 50, y: 60 } },
  { kind: "lineTo", point: { x: 170, y: 60 } },
], 0.25);

const door = primitive("door-swing", [
  { kind: "moveTo", point: { x: 200, y: 100 } },
  { kind: "curveTo", control1: { x: 210, y: 100 }, control2: { x: 220, y: 110 }, point: { x: 220, y: 120 } },
], 0.35);

const grid = primitive("grid-reference", [
  { kind: "moveTo", point: { x: 0, y: 200 } },
  { kind: "lineTo", point: { x: 200, y: 200 } },
], 0.25, [4, 2]);

const fixture = primitive("fixture", [
  { kind: "rectangle", points: [{ x: 250, y: 50 }, { x: 260, y: 50 }, { x: 260, y: 60 }, { x: 250, y: 60 }] },
  { kind: "rectangle", points: [{ x: 262, y: 50 }, { x: 272, y: 50 }, { x: 272, y: 60 }, { x: 262, y: 60 }] },
  { kind: "rectangle", points: [{ x: 274, y: 50 }, { x: 284, y: 50 }, { x: 284, y: 60 }, { x: 274, y: 60 }] },
], 0.25);

const text = [{ text: `12'-6"`, page: 1, x: 92, y: 58, width: 28, height: 8 }];
const classified = classifyArchitecturalPrimitives([wall, witness, dimension, door, grid, fixture], text);
const byId = new Map(classified.map((item) => [item.primitive.id, item]));

assert.equal(byId.get("wall-face")?.classification, "wall_face");
assert.equal(byId.get("dimension-witness")?.classification, "dimension_witness");
assert.equal(byId.get("dimension-line")?.classification, "dimension_line");
assert.equal(byId.get("door-swing")?.classification, "door_swing");
assert.equal(byId.get("grid-reference")?.classification, "grid_reference");
assert.equal(byId.get("fixture")?.classification, "fixture");
assert.ok(classified.every((item) => item.confidence > 0 && item.confidence <= 1));
assert.ok(classified.every((item) => item.reasons.length > 0));

const summary = summarizePrimitiveClasses(classified);
assert.equal(summary.wall_face, 1);
assert.equal(summary.dimension_witness, 1);
assert.equal(summary.dimension_line, 1);
assert.equal(summary.door_swing, 1);
assert.equal(summary.grid_reference, 1);
assert.equal(summary.fixture, 1);

console.log("architectural primitive classifier contract passed");
