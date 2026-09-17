import type { BosRawSegment } from "./geometry";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosPairBuilderConsistencyReason =
  | "missing_individual_face_candidate"
  | "parallel_gate"
  | "overlap_gate"
  | "thickness_gate"
  | "separation_drift_gate"
  | "greedy_face_claim_conflict"
  | "unexpected_builder_omission";

type Orientation = "horizontal" | "vertical";

type SourceFace = {
  orientation: Orientation;
  fixed: number;
  start: number;
  end: number;
};

type Candidate = {
  id: string;
  segment: BosRawSegment;
  lineFixed: number;
  start: number;
  end: number;
  length: number;
};

export type BosPairBuilderConsistencyMember = {
  representativePairId: string;
  memberPairId: string;
  reason: BosPairBuilderConsistencyReason;
  faceACandidateIds: string[];
  faceBCandidateIds: string[];
  eligiblePairCount: number;
  claimedCandidateIds: string[];
};

function sourceFaceGeometry(
  pair: BosSourceWallPairConsolidationCluster["members"][number],
  face: "a" | "b",
  input: {
    sourcePixelWidth: number;
    sourcePixelHeight: number;
    sourceWidthMeters: number;
    sourceHeightMeters: number;
  },
): SourceFace {
  const pxPerMeterX = input.sourcePixelWidth / input.sourceWidthMeters;
  const pxPerMeterY = input.sourcePixelHeight / input.sourceHeightMeters;
  const horizontal = pair.orientation === "horizontal";
  const fixedScale = horizontal ? pxPerMeterY : pxPerMeterX;
  const movingScale = horizontal ? pxPerMeterX : pxPerMeterY;
  return {
    orientation: pair.orientation,
    fixed: (face === "a" ? pair.faceAFixedPixel : pair.faceBFixedPixel) / fixedScale,
    start: Math.min(pair.startPixel, pair.endPixel) / movingScale,
    end: Math.max(pair.startPixel, pair.endPixel) / movingScale,
  };
}

function segmentOrientation(segment: BosRawSegment): Orientation {
  return Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y)
    ? "horizontal"
    : "vertical";
}

function angle(segment: BosRawSegment) {
  let value = Math.atan2(segment.end.y - segment.start.y, segment.end.x - segment.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const delta = Math.abs(a - b);
  return Math.min(delta, Math.PI - delta);
}

function candidateForFace(segment: BosRawSegment, source: SourceFace, coordinateGate: number): Candidate | null {
  const orientation = segmentOrientation(segment);
  if (orientation !== source.orientation) return null;
  const horizontal = orientation === "horizontal";
  const fixed = horizontal
    ? (segment.start.y + segment.end.y) / 2
    : (segment.start.x + segment.end.x) / 2;
  if (Math.abs(fixed - source.fixed) > coordinateGate) return null;
  const start = horizontal
    ? Math.min(segment.start.x, segment.end.x)
    : Math.min(segment.start.y, segment.end.y);
  const end = horizontal
    ? Math.max(segment.start.x, segment.end.x)
    : Math.max(segment.start.y, segment.end.y);
  if (end <= source.start || start >= source.end) return null;
  return {
    id: String(segment.sourceObjectId || "unknown"),
    segment,
    lineFixed: fixed,
    start,
    end,
    length: Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y),
  };
}

function pairMetrics(a: Candidate, b: Candidate) {
  const overlap = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const shorter = Math.max(0.000001, Math.min(a.end - a.start, b.end - b.start));
  const separation = Math.abs(a.lineFixed - b.lineFixed);
  const drift = Math.abs(
    Math.abs((a.segment.start.x - b.segment.start.x) + (a.segment.start.y - b.segment.start.y))
    - Math.abs((a.segment.end.x - b.segment.end.x) + (a.segment.end.y - b.segment.end.y)),
  );
  return {
    parallelDelta: angleDelta(angle(a.segment), angle(b.segment)),
    overlapRatio: overlap / shorter,
    separation,
    separationDrift: drift,
  };
}

function emptyCounts(): Record<BosPairBuilderConsistencyReason, number> {
  return {
    missing_individual_face_candidate: 0,
    parallel_gate: 0,
    overlap_gate: 0,
    thickness_gate: 0,
    separation_drift_gate: 0,
    greedy_face_claim_conflict: 0,
    unexpected_builder_omission: 0,
  };
}

/**
 * Read-only audit for source members that retain both required raster faces after annotation
 * suppression but still fail to produce an explicit two-face wall system. The diagnostic mirrors
 * the production raster wall-builder gates and never creates or promotes geometry.
 */
export function diagnosePairBuilderConsistencyGaps(input: {
  stageDiagnostic: BosRasterStageGapDiagnostic;
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  annotationFilteredSegments: readonly BosRawSegment[];
  explicitWallSystems: readonly BosWallSystemCandidate[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumCoordinateErrorMeters?: number;
  minWallLengthMeters?: number;
  minWallThicknessMeters?: number;
  maxWallThicknessMeters?: number;
  parallelToleranceRadians?: number;
  minOverlapRatio?: number;
}) {
  const coordinateGate = input.maximumCoordinateErrorMeters ?? 0.02;
  const minLength = input.minWallLengthMeters ?? 0.45;
  const minThickness = input.minWallThicknessMeters ?? 0.07;
  const maxThickness = input.maxWallThicknessMeters ?? 0.45;
  const parallelTolerance = input.parallelToleranceRadians ?? Math.PI / 180 * 1.75;
  const minOverlap = input.minOverlapRatio ?? 0.45;
  const clusterByRepresentative = new Map(input.consolidationClusters.map((cluster) => [cluster.representativePairId, cluster]));
  const targets = input.stageDiagnostic.members.filter((member) => member.reason === "pair_builder_consistency_gap");
  const claimedIds = new Set(input.explicitWallSystems.flatMap((system) => [system.faceA.primitiveId, system.faceB.primitiveId]));
  const members: BosPairBuilderConsistencyMember[] = [];

  for (const target of targets) {
    const cluster = clusterByRepresentative.get(target.representativePairId);
    const sourceMember = cluster?.members.find((member) => member.id === target.memberPairId);
    if (!sourceMember) continue;
    const faceA = sourceFaceGeometry(sourceMember, "a", input);
    const faceB = sourceFaceGeometry(sourceMember, "b", input);
    const aCandidates = input.annotationFilteredSegments
      .map((segment) => candidateForFace(segment, faceA, coordinateGate))
      .filter((candidate): candidate is Candidate => Boolean(candidate && candidate.length >= minLength));
    const bCandidates = input.annotationFilteredSegments
      .map((segment) => candidateForFace(segment, faceB, coordinateGate))
      .filter((candidate): candidate is Candidate => Boolean(candidate && candidate.length >= minLength));

    let reason: BosPairBuilderConsistencyReason = "unexpected_builder_omission";
    const eligiblePairs: Array<{ a: Candidate; b: Candidate }> = [];
    let sawParallelFailure = false;
    let sawOverlapFailure = false;
    let sawThicknessFailure = false;
    let sawDriftFailure = false;

    if (!aCandidates.length || !bCandidates.length) {
      reason = "missing_individual_face_candidate";
    } else {
      for (const a of aCandidates) {
        for (const b of bCandidates) {
          if (a.id === b.id) continue;
          const metrics = pairMetrics(a, b);
          if (metrics.parallelDelta > parallelTolerance) {
            sawParallelFailure = true;
            continue;
          }
          if (metrics.overlapRatio < minOverlap) {
            sawOverlapFailure = true;
            continue;
          }
          if (metrics.separation < minThickness || metrics.separation > maxThickness) {
            sawThicknessFailure = true;
            continue;
          }
          if (metrics.separationDrift > Math.max(0.02, metrics.separation * 0.12)) {
            sawDriftFailure = true;
            continue;
          }
          eligiblePairs.push({ a, b });
        }
      }
      if (!eligiblePairs.length) {
        if (sawThicknessFailure) reason = "thickness_gate";
        else if (sawOverlapFailure) reason = "overlap_gate";
        else if (sawParallelFailure) reason = "parallel_gate";
        else if (sawDriftFailure) reason = "separation_drift_gate";
      } else if (eligiblePairs.some(({ a, b }) => claimedIds.has(a.id) || claimedIds.has(b.id))) {
        reason = "greedy_face_claim_conflict";
      }
    }

    const claimedCandidateIds = [...new Set([...aCandidates, ...bCandidates]
      .filter((candidate) => claimedIds.has(candidate.id))
      .map((candidate) => candidate.id))].sort();
    members.push({
      representativePairId: target.representativePairId,
      memberPairId: target.memberPairId,
      reason,
      faceACandidateIds: [...new Set(aCandidates.map((candidate) => candidate.id))].sort(),
      faceBCandidateIds: [...new Set(bCandidates.map((candidate) => candidate.id))].sort(),
      eligiblePairCount: eligiblePairs.length,
      claimedCandidateIds,
    });
  }

  const reasonMemberCounts = emptyCounts();
  const familiesByReason = new Map<BosPairBuilderConsistencyReason, Set<string>>();
  for (const member of members) {
    reasonMemberCounts[member.reason] += 1;
    const familyIds = familiesByReason.get(member.reason) ?? new Set<string>();
    familyIds.add(member.representativePairId);
    familiesByReason.set(member.reason, familyIds);
  }
  const reasonFamilyCounts = emptyCounts();
  for (const [reason, families] of familiesByReason) reasonFamilyCounts[reason] = families.size;

  return {
    mode: "read_only_pair_builder_consistency_gap_diagnostic" as const,
    memberCount: members.length,
    familyCount: new Set(members.map((member) => member.representativePairId)).size,
    reasonMemberCounts,
    reasonFamilyCounts,
    members,
    safeToConsiderPromotion: false,
    diagnostics: [
      `${members.length} pair-builder consistency member(s) were replayed against the unchanged production raster wall-builder gates.`,
      `${reasonMemberCounts.greedy_face_claim_conflict} member(s) have an otherwise eligible pair whose raster face is already claimed by another explicit system.`,
      `${reasonMemberCounts.unexpected_builder_omission} member(s) retain an eligible unclaimed pair yet are still absent from explicit systems and remain fail-closed for direct builder replay.`,
      "Read-only diagnostic only: no pairing rule, selector default, wall, persistence, canonical geometry, or 3D output changed.",
    ],
  };
}
