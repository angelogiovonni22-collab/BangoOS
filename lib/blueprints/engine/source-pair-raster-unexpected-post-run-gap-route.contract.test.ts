import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const diagnostic = readFileSync("lib/blueprints/engine/source-pair-raster-unexpected-post-run-gap-diagnostic.ts", "utf8");

assert.match(diagnostic, /safeToConsiderPromotion: false/, "unexpected post-run gap diagnostic must remain fail-closed");
assert.match(diagnostic, /no raster setting, selector default, wall, topology, persistence, canonical geometry, or 3D output changed/, "unexpected post-run gap diagnostic must remain read-only");
assert.match(diagnostic, /adjacent_band_quantization/, "diagnostic must isolate adjacent band quantization candidates");
assert.match(diagnostic, /parallel_offset_mapping_gap/, "diagnostic must isolate parallel offset mapping gaps");
assert.match(diagnostic, /fragmented_run_mapping_gap/, "diagnostic must isolate fragmented run mapping gaps");
assert.match(diagnostic, /no_nearby_raster_run/, "diagnostic must preserve deeper extraction gaps as unresolved");

console.log("Blueprint unexpected post-run raster gap safety contract passed.");
