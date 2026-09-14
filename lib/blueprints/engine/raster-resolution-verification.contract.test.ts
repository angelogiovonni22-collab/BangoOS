import assert from "node:assert/strict";
import {
  BASELINE_BLUEPRINT_RASTER_MAX_DIMENSION,
  HIGH_RESOLUTION_BLUEPRINT_RASTER_MAX_DIMENSION,
  resolveBlueprintBenchmarkRasterMaxDimension,
} from "./raster-resolution-verification";

assert.equal(resolveBlueprintBenchmarkRasterMaxDimension(null), BASELINE_BLUEPRINT_RASTER_MAX_DIMENSION);
assert.equal(resolveBlueprintBenchmarkRasterMaxDimension(undefined), BASELINE_BLUEPRINT_RASTER_MAX_DIMENSION);
assert.equal(resolveBlueprintBenchmarkRasterMaxDimension("2400"), BASELINE_BLUEPRINT_RASTER_MAX_DIMENSION);
assert.equal(resolveBlueprintBenchmarkRasterMaxDimension("2592"), HIGH_RESOLUTION_BLUEPRINT_RASTER_MAX_DIMENSION);
assert.equal(resolveBlueprintBenchmarkRasterMaxDimension("3000"), BASELINE_BLUEPRINT_RASTER_MAX_DIMENSION, "arbitrary query values must not increase raster work");
assert.equal(resolveBlueprintBenchmarkRasterMaxDimension("99999"), BASELINE_BLUEPRINT_RASTER_MAX_DIMENSION, "unsafe raster sizes must fail closed to the baseline");

console.log("Blueprint raster resolution verification selector contract passed.");
