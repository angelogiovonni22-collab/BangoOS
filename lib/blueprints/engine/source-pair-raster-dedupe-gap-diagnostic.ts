import type { BosRawSegment } from "./geometry";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";

export type BosRasterDedupeGapReason =
  | "below_raster_min_run"
  | "dedupe_band_collision"
  | "unexpected_post_run_gap";

type FailedFaceDiagnostic = {
  face: "a" | "b";
  sourceRunPixels: number;
  rasterRunPixels: number;
  reason: BosRasterDedupeGapReason;
  expectedBandKey: string | null;
  collidingSegmentIds: string[];
};

export type BosRasterDedupeGapMember = {
  representativePairId: string;
  memberPairId: string;
  reason: BosRasterDedupeGapReason;
  failedFaces: FailedFaceDiagnostic[];
};

export type BosRasterDedupeGapDiagnostic = {
  familyCount: number;
  memberCount: number;
  failedFaceCount: number;
  reasonMemberCounts: Record<BosRasterDedupeGapReason, number>;
  reasonFaceCounts: Record<BosRasterDedupeGapReason, number>;
  reasonFamilyCounts: Record<BosRasterDedupeGapReason, number>;
  members: BosRasterDedupeGapMember[];
  diagnostics: string[];
};

type Orientation = "horizontal" | "vertical";

function orientationOf(segment: BosRawSegment): Orientation {
  return Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y) ? "horizontal" : "vertical";
}

function lineKey(input: {
  orientation: Orientation;
  fixed: number;
  start: number;
  end: number;
  bandX: number;
  bandY: number;
}) {
  return input.orientation === "horizontal"
    ? `h:${Math.round(input.fixed / input.bandY)}:${Math.round(input.start / input.bandX)}:${Math.round(input.end / input.bandX)}`
    : `v:${Math.round(input.fixed / input.bandX)}:${Math.round(input.start / input.bandY)}:${Math.round(input.end / input.bandY)}`;
}

function segmentKey(segment: BosRawSegment, bandX: number, bandY: number) {
  const orientation = orientationOf(segment);
  const fixed = orientation === "horizontal"
    ? (segment.start.y + segment.end.y) / 2
    : (segment.start.x + segment.end.x) / 2;
  const start = orientation === "horizontal"
    ? Math.min(segment.start.x, segment.end.x)
    : Math.min(segment.start.y, segment.end.y);
  const end = orientation === "horizontal"
    ? Math.max(segment.start.x, segment.end.x)
    : Math.max(segment.start.y, segment.end.y);
  return lineKey({ orientation, fixed, start, end, bandX, bandY });
}

function emptyCounts(): Record<BosRasterDedupeGapReason, number> {
  return {
    below_raster_min_run: 0,
    dedupe_band_collision: 0,
    unexpected_post_run_gap: 0,
  };
}

/**
 * Read-only attribution for extraction-face gaps already isolated by the raster-stage audit.
 * Source-family pixels come from the independent rendered source, while production raster extraction
 * may downsample that render before min-run filtering and merge-band de-duplication. Convert source
 * spans into the actual extraction pixel frame and reproduce the exact production merge-band size
 * before classifying a failed face as min-run loss, de-duplication collision, or unexplained loss.
 */
export function diagnoseRasterDedupeGaps(input: {
  stageDiagnostic: BosRasterStageGapDiagnostic;
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  rawSegments: readonly BosRawSegment[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  rasterPixelWidth: number;
  rasterPixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  rasterMinRunPixels?: number;
  mergeBandPixels?: number;
}): BosRasterDedupeGapDiagnostic {
  const minRunPixels = input.rasterMinRunPixels ?? 34;
  const mergeBandPixels = Math.max(1, input.mergeBandPixels ?? 3);
  const sourceMeterPerPixelX = input.sourceWidthMeters / input.sourcePixelWidth;
  const sourceMeterPerPixelY = input.sourceHeightMeters / input.sourcePixelHeight;
  const rasterMeterPerPixelX = input.sourceWidthMeters / input.rasterPixelWidth;
  const rasterMeterPerPixelY = input.sourceHeightMeters / input.rasterPixelHeight;
  const bandX = mergeBandPixels * rasterMeterPerPixelX;
  const bandY = mergeBandPixels * rasterMeterPerPixelY;
  const retainedByKey = new Map<string, string[]>();
  for (const segment of input.rawSegments) {
    const key = segmentKey(segment, bandX, bandY);
    retainedByKey.set(key, [...(retainedByKey.get(key) || []), String(segment.sourceObjectId || "unknown")]);
  }

  const clusterByRepresentative = new Map(input.consolidationClusters.map((cluster) => [cluster.representativePairId, cluster]));
  const stageByMember = new Map(input.stageDiagnostic.members
    .filter((member) => member.reason === "extraction_face_coverage_gap")
    .map((member) => [`${member.representativePairId}::${member.memberPairId}`, member]));
  const members: BosRasterDedupeGapMember[] = [];

  for (const [representativePairId, cluster] of clusterByRepresentative) {
    for (const member of cluster.members) {
      const stage = stageByMember.get(`${representativePairId}::${member.id}`);
      if (!stage) continue;
      const failedFaces: FailedFaceDiagnostic[] = [];
      const horizontal = member.orientation === "horizontal";
      const sourceRunPixels = Math.abs(member.endPixel - member.startPixel) + 1;
      const rasterRunPixels = sourceRunPixels * (horizontal
        ? input.rasterPixelWidth / input.sourcePixelWidth
        : input.rasterPixelHeight / input.sourcePixelHeight);
      for (const face of ["a", "b"] as const) {
        const evidence = face === "a" ? stage.rawFaceA : stage.rawFaceB;
        if (evidence.passed) continue;
        if (rasterRunPixels < minRunPixels) {
          failedFaces.push({
            face,
            sourceRunPixels,
            rasterRunPixels,
            reason: "below_raster_min_run",
            expectedBandKey: null,
            collidingSegmentIds: [],
          });
          continue;
        }
        const fixedPixel = face === "a" ? member.faceAFixedPixel : member.faceBFixedPixel;
        const fixed = fixedPixel * (horizontal ? sourceMeterPerPixelY : sourceMeterPerPixelX);
        const start = Math.min(member.startPixel, member.endPixel) * (horizontal ? sourceMeterPerPixelX : sourceMeterPerPixelY);
        const end = Math.max(member.startPixel, member.endPixel) * (horizontal ? sourceMeterPerPixelX : sourceMeterPerPixelY);
        const expectedBandKey = lineKey({ orientation: member.orientation, fixed, start, end, bandX, bandY });
        const collidingSegmentIds = retainedByKey.get(expectedBandKey) || [];
        failedFaces.push({
          face,
          sourceRunPixels,
          rasterRunPixels,
          reason: collidingSegmentIds.length ? "dedupe_band_collision" : "unexpected_post_run_gap",
          expectedBandKey,
          collidingSegmentIds,
        });
      }
      const reason: BosRasterDedupeGapReason = failedFaces.some((face) => face.reason === "dedupe_band_collision")
        ? "dedupe_band_collision"
        : failedFaces.some((face) => face.reason === "unexpected_post_run_gap")
          ? "unexpected_post_run_gap"
          : "below_raster_min_run";
      members.push({ representativePairId, memberPairId: member.id, reason, failedFaces });
    }
  }

  const reasonMemberCounts = emptyCounts();
  const reasonFaceCounts = emptyCounts();
  const reasonsByFamily = new Map<string, Set<BosRasterDedupeGapReason>>();
  for (const member of members) {
    reasonMemberCounts[member.reason] += 1;
    for (const face of member.failedFaces) reasonFaceCounts[face.reason] += 1;
    const reasons = reasonsByFamily.get(member.representativePairId) || new Set<BosRasterDedupeGapReason>();
    reasons.add(member.reason);
    reasonsByFamily.set(member.representativePairId, reasons);
  }
  const reasonFamilyCounts = emptyCounts();
  for (const reasons of reasonsByFamily.values()) for (const reason of reasons) reasonFamilyCounts[reason] += 1;

  return {
    familyCount: reasonsByFamily.size,
    memberCount: members.length,
    failedFaceCount: members.reduce((total, member) => total + member.failedFaces.length, 0),
    reasonMemberCounts,
    reasonFaceCounts,
    reasonFamilyCounts,
    members,
    diagnostics: [
      `${members.length} extraction-gap source member(s) were attributed against the unchanged ${minRunPixels}-pixel raster minimum and ${mergeBandPixels}-pixel production de-duplication bands.`,
      `Source-family spans were mapped from ${input.sourcePixelWidth}×${input.sourcePixelHeight} source pixels into the actual ${input.rasterPixelWidth}×${input.rasterPixelHeight} production extraction pixel frame before attribution.`,
      `${reasonFaceCounts.below_raster_min_run} failed source face(s) are shorter than the current raster minimum after exact extraction-scale conversion and therefore cannot survive extraction as configured.`,
      `${reasonFaceCounts.dedupe_band_collision} failed source face(s) are long enough to survive run extraction but share their exact production band key with a retained competing raster segment, isolating de-duplication loss.`,
      `${reasonFaceCounts.unexpected_post_run_gap} failed source face(s) are long enough to survive run extraction and have no retained same-band competitor; these remain fail-closed for a separate extraction mapping audit.`,
      "Read-only attribution: no raster setting, segment, wall, topology, persistence, canonical geometry, or 3D output changed.",
    ],
  };
}
