import type { BosBoundaryFamilyCandidate, BosBoundaryFamilyProvenanceDiagnostic } from "./boundary-family-provenance-diagnostic";

export type BosBoundaryFamilyDuplicateRelation = "same_source_faces" | "near_coincident_variant" | "distinct_candidates";

export type BosBoundaryFamilyDuplicatePair = {
  dimensionId: string;
  endpoint: "start" | "end";
  leftWallId: string;
  rightWallId: string;
  coordinateSeparationMeters: number;
  thicknessDeltaMeters: number;
  lengthRatio: number;
  confidenceDelta: number;
  sourceFaceOverlapCount: number;
  relation: BosBoundaryFamilyDuplicateRelation;
};

export type BosBoundaryFamilyDuplicateDiagnosticResult = {
  pairs: BosBoundaryFamilyDuplicatePair[];
  sameSourceFacePairCount: number;
  nearCoincidentVariantPairCount: number;
  distinctCandidatePairCount: number;
  ambiguousEndpointsExplainedByDuplicateEvidence: number;
  diagnostics: string[];
};

function sourceFaces(candidate: BosBoundaryFamilyCandidate) {
  return new Set([candidate.faceAPrimitiveId, candidate.faceBPrimitiveId]);
}

function faceOverlapCount(left: BosBoundaryFamilyCandidate, right: BosBoundaryFamilyCandidate) {
  const leftFaces = sourceFaces(left);
  return [...sourceFaces(right)].filter((id) => leftFaces.has(id)).length;
}

function lengthRatio(left: BosBoundaryFamilyCandidate, right: BosBoundaryFamilyCandidate) {
  const longer = Math.max(left.lengthMeters, right.lengthMeters, 0.001);
  const shorter = Math.max(Math.min(left.lengthMeters, right.lengthMeters), 0.001);
  return shorter / longer;
}

function classifyPair(
  left: BosBoundaryFamilyCandidate,
  right: BosBoundaryFamilyCandidate,
  options: { coordinateToleranceMeters: number; thicknessToleranceMeters: number; minimumLengthRatio: number },
): Omit<BosBoundaryFamilyDuplicatePair, "dimensionId" | "endpoint"> {
  const coordinateSeparationMeters = Math.abs(left.coordinate - right.coordinate);
  const thicknessDeltaMeters = Math.abs(left.thicknessMeters - right.thicknessMeters);
  const candidateLengthRatio = lengthRatio(left, right);
  const confidenceDelta = Math.abs(left.confidence - right.confidence);
  const sourceFaceOverlapCount = faceOverlapCount(left, right);
  let relation: BosBoundaryFamilyDuplicateRelation = "distinct_candidates";
  if (sourceFaceOverlapCount === 2) relation = "same_source_faces";
  else if (
    coordinateSeparationMeters <= options.coordinateToleranceMeters
    && thicknessDeltaMeters <= options.thicknessToleranceMeters
    && candidateLengthRatio >= options.minimumLengthRatio
    && sourceFaceOverlapCount >= 1
  ) relation = "near_coincident_variant";
  return {
    leftWallId: left.wallId,
    rightWallId: right.wallId,
    coordinateSeparationMeters,
    thicknessDeltaMeters,
    lengthRatio: candidateLengthRatio,
    confidenceDelta,
    sourceFaceOverlapCount,
    relation,
  };
}

/**
 * Read-only duplicate-family classifier for ambiguous dimension endpoints. It intentionally requires
 * shared source-face provenance before calling near-coincident wall-system candidates duplicate-like.
 * Coordinate proximity by itself is never enough to collapse physical boundaries.
 */
export function diagnoseBoundaryFamilyDuplicates(input: {
  provenance: readonly BosBoundaryFamilyProvenanceDiagnostic[];
  coordinateToleranceMeters?: number;
  thicknessToleranceMeters?: number;
  minimumLengthRatio?: number;
}): BosBoundaryFamilyDuplicateDiagnosticResult {
  const options = {
    coordinateToleranceMeters: input.coordinateToleranceMeters ?? 0.08,
    thicknessToleranceMeters: input.thicknessToleranceMeters ?? 0.035,
    minimumLengthRatio: input.minimumLengthRatio ?? 0.72,
  };
  const pairs: BosBoundaryFamilyDuplicatePair[] = [];
  let ambiguousEndpointsExplainedByDuplicateEvidence = 0;

  for (const dimension of input.provenance) {
    for (const endpoint of ["start", "end"] as const) {
      const candidates = endpoint === "start" ? dimension.startCandidates : dimension.endCandidates;
      if (candidates.length < 2) continue;
      let endpointHasDuplicateEvidence = false;
      for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
          const classified = classifyPair(candidates[leftIndex], candidates[rightIndex], options);
          if (classified.relation !== "distinct_candidates") endpointHasDuplicateEvidence = true;
          pairs.push({ dimensionId: dimension.dimensionId, endpoint, ...classified });
        }
      }
      if (endpointHasDuplicateEvidence) ambiguousEndpointsExplainedByDuplicateEvidence += 1;
    }
  }

  const sameSourceFacePairCount = pairs.filter((pair) => pair.relation === "same_source_faces").length;
  const nearCoincidentVariantPairCount = pairs.filter((pair) => pair.relation === "near_coincident_variant").length;
  const distinctCandidatePairCount = pairs.filter((pair) => pair.relation === "distinct_candidates").length;
  return {
    pairs,
    sameSourceFacePairCount,
    nearCoincidentVariantPairCount,
    distinctCandidatePairCount,
    ambiguousEndpointsExplainedByDuplicateEvidence,
    diagnostics: [
      `Boundary-family duplicate diagnostic compared ${pairs.length} candidate pairs at ambiguous source-resolved dimension endpoints.`,
      `${sameSourceFacePairCount} pairs reuse the same two source faces and ${nearCoincidentVariantPairCount} additional pairs are near-coincident variants with shared source-face provenance.`,
      `${ambiguousEndpointsExplainedByDuplicateEvidence} ambiguous endpoints contain duplicate-family evidence; no candidate was removed or merged.`,
      "Near-coincident classification requires shared source-face provenance; coordinate proximity alone is never treated as duplicate evidence.",
    ],
  };
}
