import assert from "node:assert/strict";
import { diagnoseUnexpectedPostRunGaps } from "./source-pair-raster-unexpected-post-run-gap-diagnostic";
import type { BosRasterDedupeGapDiagnostic } from "./source-pair-raster-dedupe-gap-diagnostic";

const baseDiagnostic: BosRasterDedupeGapDiagnostic = {
  familyCount: 1,
  memberCount: 1,
  failedFaceCount: 1,
  reasonMemberCounts: { below_raster_min_run: 0, dedupe_band_collision: 0, unexpected_post_run_gap: 1 },
  reasonFaceCounts: { below_raster_min_run: 0, dedupe_band_collision: 0, unexpected_post_run_gap: 1 },
  reasonFamilyCounts: { below_raster_min_run: 0, dedupe_band_collision: 0, unexpected_post_run_gap: 1 },
  members: [{
    representativePairId: "family-a",
    memberPairId: "member-a",
    reason: "unexpected_post_run_gap",
    failedFaces: [{
      face: "a",
      sourceRunPixels: 120,
      rasterRunPixels: 111,
      reason: "unexpected_post_run_gap",
      expectedBandKey: "h:10:20:40",
      expectedOrientation: "horizontal",
      expectedFixedMeters: 3,
      expectedStartMeters: 6,
      expectedEndMeters: 12,
      collidingSegmentIds: [],
    }],
  }],
  diagnostics: [],
};

const adjacent = diagnoseUnexpectedPostRunGaps({
  dedupeGapDiagnostic: baseDiagnostic,
  rawSegments: [{
    sourcePage: 1,
    sourceObjectId: "segment-a",
    start: { x: 6.3, y: 3.3 },
    end: { x: 12.3, y: 3.3 },
    confidence: 1,
  }],
  rasterPixelWidth: 100,
  rasterPixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  mergeBandPixels: 3,
});

assert.equal(adjacent.faceCount, 1);
assert.equal(adjacent.familyCount, 1);
assert.equal(adjacent.faces[0]?.reason, "adjacent_band_quantization");
assert.equal(adjacent.faces[0]?.nearestSegmentId, "segment-a");
assert(Math.abs((adjacent.faces[0]?.exactCoordinateErrorMeters ?? 0) - 0.3) < 1e-9);
assert(Math.abs((adjacent.faces[0]?.exactSourceSpanCoverageRatio ?? 0) - 0.95) < 1e-9);
assert.equal(adjacent.faces[0]?.exactCoordinateGatePassed, false);
assert.equal(adjacent.faces[0]?.exactCoverageGatePassed, true);
assert.equal(adjacent.safeToConsiderPromotion, false);

const missing = diagnoseUnexpectedPostRunGaps({
  dedupeGapDiagnostic: baseDiagnostic,
  rawSegments: [],
  rasterPixelWidth: 100,
  rasterPixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  mergeBandPixels: 3,
});
assert.equal(missing.faces[0]?.reason, "no_nearby_raster_run");
assert.equal(missing.reasonFaceCounts.no_nearby_raster_run, 1);

console.log("Blueprint unexpected post-run raster gap diagnostic contract passed.");
