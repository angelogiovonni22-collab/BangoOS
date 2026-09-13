import type { BosDimension } from "./building-graph";
import type { BosBoundaryFamilyCandidate, BosBoundaryFamilyProvenanceDiagnostic } from "./boundary-family-provenance-diagnostic";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosIndependentBoundaryFamily, BosIndependentDimensionBoundaryDiagnostic } from "./source-network-dimension-endpoint-diagnostic";

type CandidateFamily = {
  coordinate: number;
  wallIds: string[];
  maxLengthMeters: number;
};

type RankedIndependentFamily = BosIndependentBoundaryFamily & {
  maxSourcePairLengthMeters: number;
};

export type BosCrossEvidenceBoundaryConvergenceReason =
  | "unique_cross_evidence_boundary_pair"
  | "no_dominant_source_anchor"
  | "no_cross_evidence_pair"
  | "ambiguous_cross_evidence_pair";

export type BosCrossEvidenceBoundaryConvergenceDiagnostic = {
  dimensionId: string;
  rawText: string;
  dominantStartCoordinate: number | null;
  dominantEndCoordinate: number | null;
  dominantStartLengthMeters: number | null;
  dominantEndLengthMeters: number | null;
  candidates: Array<{
    independentStartCoordinate: number;
    independentEndCoordinate: number;
    candidateStartCoordinate: number;
    candidateEndCoordinate: number;
    independentRelativeSpanError: number;
    candidateRelativeSpanError: number;
    candidateStartWallIds: string[];
    candidateEndWallIds: string[];
  }>;
  recommendedStartCoordinate: number | null;
  recommendedEndCoordinate: number | null;
  reason: BosCrossEvidenceBoundaryConvergenceReason;
};

function clusterCandidateFamilies(items: readonly BosBoundaryFamilyCandidate[], toleranceMeters: number) {
  const eligible = [...items].sort((a, b) => a.coordinate - b.coordinate);
  const groups: BosBoundaryFamilyCandidate[][] = [];
  for (const item of eligible) {
    const current = groups[groups.length - 1];
    const center = current?.length ? current.reduce((sum, value) => sum + value.coordinate, 0) / current.length : null;
    if (!current || center === null || Math.abs(item.coordinate - center) > toleranceMeters) groups.push([item]);
    else current.push(item);
  }
  return groups.map((group): CandidateFamily => ({
    coordinate: group.reduce((sum, item) => sum + item.coordinate, 0) / group.length,
    wallIds: group.map((item) => item.wallId),
    maxLengthMeters: Math.max(...group.map((item) => item.lengthMeters)),
  }));
}

function rankIndependentFamilies(
  families: readonly BosIndependentBoundaryFamily[],
  pairById: ReadonlyMap<string, BosSourceWallFacePair>,
  endpointAlignmentMeters: number,
): RankedIndependentFamily[] {
  return families
    .filter((family) => family.nearestEndpointDistanceMeters <= endpointAlignmentMeters)
    .map((family) => ({
      ...family,
      maxSourcePairLengthMeters: Math.max(0, ...family.pairIds.map((id) => pairById.get(id)?.lengthMeters || 0)),
    }))
    .sort((a, b) => b.maxSourcePairLengthMeters - a.maxSourcePairLengthMeters || a.nearestEndpointDistanceMeters - b.nearestEndpointDistanceMeters);
}

function dominantExtentFamily(families: readonly RankedIndependentFamily[], dominanceRatio: number) {
  const top = families[0];
  if (!top || !(top.maxSourcePairLengthMeters > 0)) return null;
  const second = families[1];
  if (second && top.maxSourcePairLengthMeters < second.maxSourcePairLengthMeters * dominanceRatio) return null;
  return top;
}

function uniqueAlignedCandidateFamily(
  coordinate: number,
  families: readonly CandidateFamily[],
  toleranceMeters: number,
) {
  const matches = families.filter((family) => Math.abs(family.coordinate - coordinate) <= toleranceMeters)
    .sort((a, b) => Math.abs(a.coordinate - coordinate) - Math.abs(b.coordinate - coordinate));
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Read-only convergence diagnostic. It asks whether ambiguous independent rendered-source boundary
 * evidence and the existing reconstructed boundary families converge on exactly one strict printed-span
 * solution. A source endpoint may act as a structural anchor only when its longest retained source-wall
 * pair is at least twice the next-longest eligible family. The diagnostic never promotes or moves walls.
 */
export function diagnoseCrossEvidenceBoundaryConvergence(input: {
  dimensions: readonly BosDimension[];
  independentDiagnostics: readonly BosIndependentDimensionBoundaryDiagnostic[];
  provenance: readonly BosBoundaryFamilyProvenanceDiagnostic[];
  wallFacePairs: readonly BosSourceWallFacePair[];
  endpointAlignmentMeters?: number;
  familyAlignmentMeters?: number;
  maximumRelativeSpanError?: number;
  sourceExtentDominanceRatio?: number;
}) {
  const endpointAlignmentMeters = input.endpointAlignmentMeters ?? 0.32;
  const familyAlignmentMeters = input.familyAlignmentMeters ?? 0.08;
  const maximumRelativeSpanError = input.maximumRelativeSpanError ?? 0.015;
  const sourceExtentDominanceRatio = input.sourceExtentDominanceRatio ?? 2;
  const dimensionById = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));
  const provenanceById = new Map(input.provenance.map((item) => [item.dimensionId, item]));
  const pairById = new Map(input.wallFacePairs.map((pair) => [pair.id, pair]));
  const dimensions: BosCrossEvidenceBoundaryConvergenceDiagnostic[] = [];

  for (const independent of input.independentDiagnostics) {
    if (independent.reason !== "ambiguous_independent_boundary_pair") continue;
    const dimension = dimensionById.get(independent.dimensionId);
    const provenance = provenanceById.get(independent.dimensionId);
    if (!dimension || !provenance || !(dimension.value > 0)) continue;

    const startIndependent = rankIndependentFamilies(independent.startFamilies, pairById, endpointAlignmentMeters);
    const endIndependent = rankIndependentFamilies(independent.endFamilies, pairById, endpointAlignmentMeters);
    const dominantStart = dominantExtentFamily(startIndependent, sourceExtentDominanceRatio);
    const dominantEnd = dominantExtentFamily(endIndependent, sourceExtentDominanceRatio);
    const candidateStarts = clusterCandidateFamilies(
      provenance.startCandidates.filter((item) => item.endpointDistanceMeters <= endpointAlignmentMeters),
      familyAlignmentMeters,
    );
    const candidateEnds = clusterCandidateFamilies(
      provenance.endCandidates.filter((item) => item.endpointDistanceMeters <= endpointAlignmentMeters),
      familyAlignmentMeters,
    );

    const candidates = independent.passingPairs.flatMap((pair) => {
      if (pair.relativeSpanError > maximumRelativeSpanError) return [];
      if (dominantStart && Math.abs(pair.startCoordinate - dominantStart.coordinate) > familyAlignmentMeters) return [];
      if (dominantEnd && Math.abs(pair.endCoordinate - dominantEnd.coordinate) > familyAlignmentMeters) return [];
      const candidateStart = uniqueAlignedCandidateFamily(pair.startCoordinate, candidateStarts, familyAlignmentMeters);
      const candidateEnd = uniqueAlignedCandidateFamily(pair.endCoordinate, candidateEnds, familyAlignmentMeters);
      if (!candidateStart || !candidateEnd || candidateStart === candidateEnd) return [];
      const candidateSpan = Math.abs(candidateEnd.coordinate - candidateStart.coordinate);
      const candidateRelativeSpanError = Math.abs(candidateSpan - dimension.value) / Math.max(dimension.value, 0.001);
      if (candidateRelativeSpanError > maximumRelativeSpanError) return [];
      return [{
        independentStartCoordinate: pair.startCoordinate,
        independentEndCoordinate: pair.endCoordinate,
        candidateStartCoordinate: candidateStart.coordinate,
        candidateEndCoordinate: candidateEnd.coordinate,
        independentRelativeSpanError: pair.relativeSpanError,
        candidateRelativeSpanError,
        candidateStartWallIds: candidateStart.wallIds,
        candidateEndWallIds: candidateEnd.wallIds,
      }];
    });

    let reason: BosCrossEvidenceBoundaryConvergenceReason;
    let recommendedStartCoordinate: number | null = null;
    let recommendedEndCoordinate: number | null = null;
    if (!dominantStart && !dominantEnd) reason = "no_dominant_source_anchor";
    else if (!candidates.length) reason = "no_cross_evidence_pair";
    else if (candidates.length > 1) reason = "ambiguous_cross_evidence_pair";
    else {
      reason = "unique_cross_evidence_boundary_pair";
      recommendedStartCoordinate = candidates[0].candidateStartCoordinate;
      recommendedEndCoordinate = candidates[0].candidateEndCoordinate;
    }

    dimensions.push({
      dimensionId: independent.dimensionId,
      rawText: independent.rawText,
      dominantStartCoordinate: dominantStart?.coordinate ?? null,
      dominantEndCoordinate: dominantEnd?.coordinate ?? null,
      dominantStartLengthMeters: dominantStart?.maxSourcePairLengthMeters ?? null,
      dominantEndLengthMeters: dominantEnd?.maxSourcePairLengthMeters ?? null,
      candidates,
      recommendedStartCoordinate,
      recommendedEndCoordinate,
      reason,
    });
  }

  const uniqueConvergenceCount = dimensions.filter((item) => item.reason === "unique_cross_evidence_boundary_pair").length;
  return {
    dimensions,
    uniqueConvergenceCount,
    diagnostics: [
      `Cross-evidence boundary convergence inspected ${dimensions.length} independently ambiguous dimensions.`,
      `${uniqueConvergenceCount} converge on one existing boundary pair within ${(maximumRelativeSpanError * 100).toFixed(1)}% printed-span error after a ${sourceExtentDominanceRatio.toFixed(1)}x source-extent anchor test.`,
      "Read-only: convergence evidence does not promote, move, synthesize, or persist geometry.",
    ],
  };
}
