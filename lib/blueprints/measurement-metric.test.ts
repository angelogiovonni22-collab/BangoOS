import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compatibleMeasurementSurface, drawingArea, drawingDistance, MEASUREMENT_METRIC_VERSION, validMeasurementMetric, type MeasurementLine } from "./measurement-metric";

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

// These are physical pixel offsets, independently normalized as pointer events
// are. Include the letterboxed surface observed on Production, both page
// orientations, square/image surfaces, zoom, and vertical/diagonal calibration.
let cases = 0;
for (const [width, height] of [[1216.32, 720], [932, 720], [556, 720], [800, 800], [1440, 900]]) {
  for (const zoom of [0.5, 0.96, 1, 2.5]) {
    for (const [cx, cy, known] of [[72, 0, 4], [0, 72, 4], [54, 72, 5]]) {
      const aspect = width / height;
      const normalized = (x: number, y: number): MeasurementLine => ({ x1: 0.1, y1: 0.1, x2: 0.1 + x * zoom / (width * zoom), y2: 0.1 + y * zoom / (height * zoom) });
      const scale = known / drawingDistance(normalized(cx, cy), aspect);
      close(drawingDistance(normalized(360, 0), aspect) * scale, 20);
      close(drawingDistance(normalized(0, 216), aspect) * scale, 12);
      close(drawingDistance(normalized(360, 216), aspect) * scale, Math.hypot(20, 12));
      close(drawingArea(normalized(360, 216), aspect) * scale ** 2, 240);
      close(drawingArea(normalized(-360, -216), aspect) * scale ** 2, 240);
      const metric = { measurementMetricVersion: MEASUREMENT_METRIC_VERSION, coordinateAspectRatio: aspect };
      assert.ok(compatibleMeasurementSurface(metric, aspect));
      assert.ok(!compatibleMeasurementSurface(metric, aspect * 1.2));
      cases++;
    }
  }
}
for (const bad of [{}, { measurementMetricVersion: 1, coordinateAspectRatio: 1 }, { measurementMetricVersion: 2, coordinateAspectRatio: 0 }, { measurementMetricVersion: 2, coordinateAspectRatio: NaN }, { measurementMetricVersion: 2, coordinateAspectRatio: "1" }]) {
  assert.equal(validMeasurementMetric(bad), false);
  assert.equal(compatibleMeasurementSurface(bad, 1), false);
}
const source = readFileSync("components/plans/blueprint-markup-surface.tsx", "utf8");
assert.ok(source.includes("drawingDistance(line, coordinateAspectRatio)"));
assert.ok(source.includes("drawingArea(line, coordinateAspectRatio)"));
assert.ok(source.includes("compatibleMeasurementSurface(calibration.geometry, coordinateAspectRatio)"));
assert.ok(source.includes("calibrationId: calibration.id"));
assert.ok(source.includes("Earlier measurements need verification."));
assert.ok(source.includes("Boolean(selectedEstimateId) && validMeasurementMetric(markup.geometry)"));
assert.ok(!source.includes("normalizedDistance("));
console.log(`PASS: ${cases} calibrated geometry scenarios, invalid/legacy metric rejection, layout guards, and viewer integration`);
