import assert from "node:assert/strict";
import { extractPdfPathGeometry } from "./pdf-vector-parser";

const OPS = {
  save: 1,
  restore: 2,
  transform: 3,
  setLineWidth: 4,
  setDash: 5,
  constructPath: 6,
  moveTo: 10,
  lineTo: 11,
  rectangle: 12,
  closePath: 13,
  curveTo: 14,
  curveTo2: 15,
  curveTo3: 16,
};

const operatorList = {
  fnArray: [OPS.save, OPS.transform, OPS.setLineWidth, OPS.setDash, OPS.constructPath, OPS.restore],
  argsArray: [
    [],
    [2, 0, 0, 3, 10, 20],
    [0.5],
    [[3, 1], 2],
    [
      [OPS.moveTo, OPS.lineTo, OPS.rectangle, OPS.moveTo, OPS.curveTo, OPS.closePath],
      [
        1, 2,
        4, 6,
        10, 20, 5, 7,
        30, 40,
        31, 41, 32, 42, 33, 43,
      ],
    ],
    [],
  ],
};

const result = extractPdfPathGeometry(operatorList, OPS, 1);
assert.equal(result.primitives.length, 1, "One PDF constructPath must remain one native primitive");
assert.equal(result.segments.length, 6, "Supported straight source geometry must be reproduced without promoting curves to walls");

const primitive = result.primitives[0];
assert.equal(primitive.id, "pdf-path-1-4");
assert.equal(primitive.lineWidth, 0.5);
assert.deepEqual(primitive.dashArray, [3, 1]);
assert.equal(primitive.dashPhase, 2);
assert.deepEqual(primitive.commands[0], { kind: "moveTo", point: { x: 12, y: 26 } });
assert.deepEqual(primitive.commands[1], { kind: "lineTo", point: { x: 18, y: 38 } });

const rectangle = primitive.commands[2];
assert.equal(rectangle.kind, "rectangle");
if (rectangle.kind === "rectangle") {
  assert.deepEqual(rectangle.points, [
    { x: 30, y: 80 },
    { x: 40, y: 80 },
    { x: 40, y: 101 },
    { x: 30, y: 101 },
  ]);
}

const curve = primitive.commands[4];
assert.equal(curve.kind, "curveTo");
if (curve.kind === "curveTo") {
  assert.deepEqual(curve.control1, { x: 72, y: 143 });
  assert.deepEqual(curve.control2, { x: 74, y: 146 });
  assert.deepEqual(curve.point, { x: 76, y: 149 });
}

assert.deepEqual(result.segments[0].start, { x: 12, y: 26 });
assert.deepEqual(result.segments[0].end, { x: 18, y: 38 });
assert.equal(result.segments[0].sourceObjectId, primitive.id);

console.log("pdf vector fidelity contract passed");
