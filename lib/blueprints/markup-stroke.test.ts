import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { finishBlueprintStroke } from "./markup-stroke";
import { drawingArea, drawingDistance } from "./measurement-metric";

const start = { x: 0.1, y: 0.1 };
const partial = { x: 0.15, y: 0.13 };
const endpoint = { x: 0.6, y: 0.4 };
const moveHistory = [start, partial];
for (const moves of [[start], moveHistory]) {
  const finished = finishBlueprintStroke(moves, endpoint);
  assert.deepEqual(finished, [start, endpoint]);
  const line = { x1: finished[0].x, y1: finished[0].y, x2: finished[1].x, y2: finished[1].y };
  assert.ok(Math.abs(drawingArea(line, 1) * 40 ** 2 - 240) < 1e-8);
  assert.ok(Math.abs(drawingDistance({ ...line, y2: line.y1 }, 1) * 40 - 20) < 1e-8);
}
assert.deepEqual(moveHistory, [start, partial], "Finalization must not mutate recorded move history");
assert.deepEqual(finishBlueprintStroke([], endpoint), []);
assert.deepEqual(finishBlueprintStroke([start], start), [], "Click is not a measurement");
assert.deepEqual(finishBlueprintStroke([start], start, true), []);
assert.deepEqual(finishBlueprintStroke(moveHistory, start), [], "A zero-length line must not use an earlier move");
assert.deepEqual(finishBlueprintStroke(moveHistory, endpoint, true), [start, partial, endpoint]);
assert.deepEqual(finishBlueprintStroke(moveHistory, start, true), [start, partial, start], "Closed freehand strokes remain valid");

const source = readFileSync("components/plans/blueprint-markup-surface.tsx", "utf8");
const pointerDown = source.slice(source.indexOf("const handlePointerDown"), source.indexOf("const handlePointerMove"));
assert.ok(pointerDown.indexOf("event.preventDefault()") > pointerDown.indexOf('tool === "pan"'), "Active drawing must suppress native selection after respecting the pan/saving guard");
assert.ok(source.includes("h-full w-full select-none"), "Existing SVG labels must not start native text selection");
assert.ok(source.includes("const rawEndpoint = pointFromEvent(event)"));
assert.ok(source.includes('finishBlueprintStroke(activeDraft.points, endpoint, tool === "freehand")'));
assert.ok(source.includes("snapBlueprintPoint(rawEndpoint, activeDraft.start"));
assert.ok(source.includes("onPointerCancel={handlePointerCancel}"));
const cancel = source.slice(source.indexOf("const handlePointerCancel"), source.indexOf("const removeMarkup"));
assert.ok(cancel.includes("pointerId !== event.pointerId"));
assert.ok(cancel.includes("draftRef.current = null"));
assert.ok(!cancel.includes("persist("), "Cancelled gestures must not create a partial annotation");
console.log("PASS: missing/coalesced final moves use release endpoint; accurate distance/area; clicks, freehand, snapping integration and cancellation guards");
