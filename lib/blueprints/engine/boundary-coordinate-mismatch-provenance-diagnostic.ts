import type { BosWallSystemCandidate } from "./wall-system-builder";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosIndependentDimensionBoundaryDiagnostic } from "./source-network-dimension-endpoint-diagnostic";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";

export type BosBoundaryCoordinateMismatchProvenanceReason =
  | "within_coordinate_target"
  | "candidate_source_family_mismatch"
  | "missing_source_family"
  | "missing_candidate_wall";

export type BosBoundaryCoordinateMismatchEndpoint = {
  endpoint: "start" | "end";
  independentCoordinate: number;
  candidateCoordinate: number;
  coordinateOffsetMeters: number;
  candidateWallIds: string[];
  candidateThicknessMeters: number[];
  candidateFacePrimitiveIds: string[];
  sourcePairIds: string[];
  sourcePairSeparationMeters: number[];
  sourcePairCenterCoordinates: number[];
  minimumSourcePairCenterOffsetMeters: number | null;
  reason: BosBoundaryCoordinateMismatchProvenanceReason;
};

export type BosBoundaryCoordinateMismatchProvenanceDiagnostic = {
  dimensionId: string;
  rawText: string;
  endpoints: BosBoundaryCoordinateMismatchEndpoint[];
  maximumCoordinateOffsetMeters: number;
  reason: BosBoundaryCoordinateMismatchProvenanceReason;
};

function wallFixedCoordinate(wall: BosWallSystemCandidate) {
  const dx = Math.abs(wall.centerline.end.x - wall.centerline.start.x);
  const dy = Math.abs(wall.centerline.end.y - wall.centerline.start.y);
  return dy >= dx
    ? (wall.centerline.start.x + wall.centerline.end.x) / 2
    : (wall.centerline.start.y + wall.centerline.end.y) / 2;
}

function sourcePairCoordinate(input: {
  pair: BosSourceWallFacePair;
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
}) {
  return input.pair.orientation === "vertical"
    ? input.pair.centerFixedPixel / input.sourcePixelWidth * input.sourceWidthMeters
    : input.pair.centerFixedPixel / input.sourcePixelHeight * input.sourceHeightMeters;
}

/**
 * Read-only provenance for cross-evidence coordinate mismatches. It exposes the exact reconstructed
 * wall faces and retained rendered-source wall-face pairs behind each converged endpoint so a later
 * fix can distinguish source-pair selection error from a true geometry offset. No geometry changes.
 */
export function diagnoseBoundaryCoordinateMismatchProvenance(input: {
  convergence: readonly BosCrossEvidenceBoundaryConvergenceDiagnostic[];
  independentDiagnostics: readonly BosIndependentDimensionBoundaryDiagnostic[];
  wallSystems: readonly BosWallSystemCandidate[];
  wallFacePairs: readonly BosSourceWallFacePair[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  maximumBoundaryOffsetMeters?: number;
  sourceFamilyToleranceMeters?: number;
}) {
  const maximumBoundaryOffsetMeters = input.maximumBoundaryOffsetMeters ?? 0.02;
  const sourceFamilyToleranceMeters = input.sourceFamilyToleranceMeters ?? 0.08;
  const wallById = new Map(input.wallSystems.map((wall) => [wall.id, wall]));
  const pairById = new Map(input.wallFacePairs.map((pair) => [pair.id, pair]));
  const independentById = new Map(input.independentDiagnostics.map((item) => [item.dimensionId, item]));
  const dimensions: BosBoundaryCoordinateMismatchProvenanceDiagnostic[] = [];

  for (const item of input.convergence) {
    if (item.reason !== "unique_cross_evidence_boundary_pair" || item.candidates.length !== 1) continue;
    const candidate = item.candidates[0];
    const independent = independentById.get(item.dimensionId);
    if (!independent) continue;

    const endpointSpecs = [
      { endpoint: "start" as const, independentCoordinate: candidate.independentStartCoordinate, candidateCoordinate: candidate.candidateStartCoordinate, wallIds: candidate.candidateStartWallIds, families: independent.startFamilies },
      { endpoint: "end" as const, independentCoordinate: candidate.independentEndCoordinate, candidateCoordinate: candidate.candidateEndCoordinate, wallIds: candidate.candidateEndWallIds, families: independent.endFamilies },
    ];

    const endpoints = endpointSpecs.map((spec): BosBoundaryCoordinateMismatchEndpoint => {
      const coordinateOffsetMeters = Math.abs(spec.candidateCoordinate - spec.independentCoordinate);
      const walls = spec.wallIds.map((id) => wallById.get(id)).filter((wall): wall is BosWallSystemCandidate => Boolean(wall));
      const family = [...spec.families]
        .sort((a, b) => Math.abs(a.coordinate - spec.independentCoordinate) - Math.abs(b.coordinate - spec.independentCoordinate))[0];
      const sourcePairs = family && Math.abs(family.coordinate - spec.independentCoordinate) <= sourceFamilyToleranceMeters
        ? family.pairIds.map((id) => pairById.get(id)).filter((pair): pair is BosSourceWallFacePair => Boolean(pair))
        : [];
      const sourcePairCenterCoordinates = sourcePairs.map((pair) => sourcePairCoordinate({
        pair,
        sourcePixelWidth: input.sourcePixelWidth,
        sourcePixelHeight: input.sourcePixelHeight,
        sourceWidthMeters: input.sourceWidthMeters,
        sourceHeightMeters: input.sourceHeightMeters,
      }));
      const minimumSourcePairCenterOffsetMeters = sourcePairCenterCoordinates.length
        ? Math.min(...sourcePairCenterCoordinates.map((coordinate) => Math.abs(coordinate - spec.candidateCoordinate)))
        : null;

      let reason: BosBoundaryCoordinateMismatchProvenanceReason = "within_coordinate_target";
      if (walls.length !== spec.wallIds.length) reason = "missing_candidate_wall";
      else if (!sourcePairs.length) reason = "missing_source_family";
      else if (coordinateOffsetMeters > maximumBoundaryOffsetMeters) reason = "candidate_source_family_mismatch";

      return {
        endpoint: spec.endpoint,
        independentCoordinate: spec.independentCoordinate,
        candidateCoordinate: spec.candidateCoordinate,
        coordinateOffsetMeters,
        candidateWallIds: spec.wallIds,
        candidateThicknessMeters: walls.map((wall) => wall.thickness),
        candidateFacePrimitiveIds: walls.flatMap((wall) => [wall.faceA.primitiveId, wall.faceB.primitiveId]),
        sourcePairIds: sourcePairs.map((pair) => pair.id),
        sourcePairSeparationMeters: sourcePairs.map((pair) => pair.separationMeters),
        sourcePairCenterCoordinates,
        minimumSourcePairCenterOffsetMeters,
        reason,
      };
    });

    const maximumCoordinateOffsetMeters = Math.max(0, ...endpoints.map((endpoint) => endpoint.coordinateOffsetMeters));
    const reason = endpoints.find((endpoint) => endpoint.reason !== "within_coordinate_target")?.reason ?? "within_coordinate_target";
    dimensions.push({ dimensionId: item.dimensionId, rawText: item.rawText, endpoints, maximumCoordinateOffsetMeters, reason });
  }

  const mismatchCount = dimensions.filter((item) => item.reason === "candidate_source_family_mismatch").length;
  return {
    dimensions,
    mismatchCount,
    diagnostics: [
      `Boundary-coordinate provenance inspected ${dimensions.length} uniquely converged dimension(s).`,
      `${mismatchCount} exceed the ${(maximumBoundaryOffsetMeters * 100).toFixed(0)} cm candidate-to-source coordinate target.`,
      "Read-only: candidate wall faces and retained rendered-source pair provenance are reported without moving, promoting, synthesizing, or persisting geometry.",
    ],
  };
}
