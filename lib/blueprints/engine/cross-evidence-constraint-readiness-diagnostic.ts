import type { BosDimension } from "./building-graph";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import type { BosSourcePixelOverlayReport } from "./source-pixel-overlay";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";
import type { BosSourceFamilyMemberAgreementDiagnostic } from "./source-family-member-agreement-diagnostic";

export type BosCrossEvidenceConstraintReadinessReason =
  | "ready_for_read_only_constraint_simulation"
  | "not_uniquely_converged"
  | "missing_candidate_wall"
  | "insufficient_source_pixel_support"
  | "boundary_coordinate_mismatch"
  | "span_residual_too_high";

export type BosBoundaryCandidateWallProvenance = {
  wallId: string;
  centerCoordinate: number;
  thicknessMeters: number;
  lengthMeters: number;
  facePrimitiveIds: [string, string];
  sourcePixelSupport: number | null;
};

export type BosCrossEvidenceConstraintReadinessDiagnostic = {
  dimensionId: string;
  rawText: string;
  candidateWallIds: string[];
  startCandidateWalls: BosBoundaryCandidateWallProvenance[];
  endCandidateWalls: BosBoundaryCandidateWallProvenance[];
  minimumWallSourceSupport: number | null;
  startBoundaryOffsetMeters: number | null;
  endBoundaryOffsetMeters: number | null;
  maximumBoundaryOffsetMeters: number | null;
  independentRelativeSpanError: number | null;
  memberRelativeSpanError: number | null;
  candidateRelativeSpanError: number | null;
  boundaryComparisonBasis: "family_representative" | "verified_family_member";
  ready: boolean;
  reason: BosCrossEvidenceConstraintReadinessReason;
};

function fixedCoordinate(wall: BosWallSystemCandidate) {
  const dx = Math.abs(wall.centerline.end.x - wall.centerline.start.x);
  const dy = Math.abs(wall.centerline.end.y - wall.centerline.start.y);
  return dy >= dx
    ? (wall.centerline.start.x + wall.centerline.end.x) / 2
    : (wall.centerline.start.y + wall.centerline.end.y) / 2;
}

/**
 * Read-only gate between evidence convergence and any later constraint-consumption simulation.
 * It verifies that the converged pair refers only to retained candidate walls, that every referenced
 * wall remains directly supported by rendered source pixels, that candidate boundary coordinates stay
 * within the strict source-coordinate fidelity target, and that both independent and candidate spans
 * stay inside the strict fidelity residual. When an already-selected source family has exactly one
 * member that independently agrees with the candidate in both coordinate and two-face thickness, the
 * member coordinate is used for the fidelity comparison instead of the family's representative.
 * No constraints or geometry are changed here.
 */
export function diagnoseCrossEvidenceConstraintReadiness(input: {
  convergence: readonly BosCrossEvidenceBoundaryConvergenceDiagnostic[];
  wallSystems: readonly BosWallSystemCandidate[];
  sourcePixelOverlay: BosSourcePixelOverlayReport;
  sourceFamilyMemberAgreement?: readonly BosSourceFamilyMemberAgreementDiagnostic[];
  dimensions?: readonly BosDimension[];
  minimumWallSourceSupport?: number;
  maximumBoundaryOffsetMeters?: number;
  maximumRelativeSpanError?: number;
}) {
  const minimumWallSourceSupport = input.minimumWallSourceSupport ?? 0.95;
  const maximumBoundaryOffsetMeters = input.maximumBoundaryOffsetMeters ?? 0.02;
  const maximumRelativeSpanError = input.maximumRelativeSpanError ?? 0.015;
  const wallById = new Map(input.wallSystems.map((wall) => [wall.id, wall]));
  const wallIds = new Set(wallById.keys());
  const supportById = new Map(input.sourcePixelOverlay.perWallSupport.map((item) => [item.wallSystemId, item.support]));
  const memberAgreementById = new Map((input.sourceFamilyMemberAgreement || []).map((item) => [item.dimensionId, item]));
  const dimensionById = new Map((input.dimensions || []).map((item) => [item.id, item]));
  const wallProvenance = (ids: readonly string[]): BosBoundaryCandidateWallProvenance[] => ids
    .map((id) => wallById.get(id))
    .filter((wall): wall is BosWallSystemCandidate => Boolean(wall))
    .map((wall) => ({
      wallId: wall.id,
      centerCoordinate: fixedCoordinate(wall),
      thicknessMeters: wall.thickness,
      lengthMeters: wall.length,
      facePrimitiveIds: [wall.faceA.primitiveId, wall.faceB.primitiveId],
      sourcePixelSupport: supportById.get(wall.id) ?? null,
    }));
  const diagnostics: BosCrossEvidenceConstraintReadinessDiagnostic[] = input.convergence.map((item) => {
    const candidate = item.reason === "unique_cross_evidence_boundary_pair" && item.candidates.length === 1
      ? item.candidates[0]
      : null;
    if (!candidate) {
      return {
        dimensionId: item.dimensionId,
        rawText: item.rawText,
        candidateWallIds: [],
        startCandidateWalls: [],
        endCandidateWalls: [],
        minimumWallSourceSupport: null,
        startBoundaryOffsetMeters: null,
        endBoundaryOffsetMeters: null,
        maximumBoundaryOffsetMeters: null,
        independentRelativeSpanError: null,
        memberRelativeSpanError: null,
        candidateRelativeSpanError: null,
        boundaryComparisonBasis: "family_representative" as const,
        ready: false,
        reason: "not_uniquely_converged" as const,
      };
    }

    const candidateWallIds = [...new Set([...candidate.candidateStartWallIds, ...candidate.candidateEndWallIds])];
    const startCandidateWalls = wallProvenance(candidate.candidateStartWallIds);
    const endCandidateWalls = wallProvenance(candidate.candidateEndWallIds);
    const missingWall = candidateWallIds.some((id) => !wallIds.has(id));
    const supports = candidateWallIds.map((id) => supportById.get(id)).filter((value): value is number => typeof value === "number");
    const minimumObservedSupport = supports.length ? Math.min(...supports) : null;
    const supportComplete = supports.length === candidateWallIds.length;

    const memberAgreement = memberAgreementById.get(item.dimensionId);
    const verifiedStart = memberAgreement?.ready ? memberAgreement.start.recommendedMatch : null;
    const verifiedEnd = memberAgreement?.ready ? memberAgreement.end.recommendedMatch : null;
    const useVerifiedMembers = Boolean(verifiedStart && verifiedEnd);
    const startBoundaryOffsetMeters = useVerifiedMembers
      ? verifiedStart!.coordinateErrorMeters
      : Math.abs(candidate.candidateStartCoordinate - candidate.independentStartCoordinate);
    const endBoundaryOffsetMeters = useVerifiedMembers
      ? verifiedEnd!.coordinateErrorMeters
      : Math.abs(candidate.candidateEndCoordinate - candidate.independentEndCoordinate);
    const maximumObservedBoundaryOffsetMeters = Math.max(startBoundaryOffsetMeters, endBoundaryOffsetMeters);

    const dimension = dimensionById.get(item.dimensionId);
    const memberRelativeSpanError = useVerifiedMembers && dimension && dimension.value > 0
      ? Math.abs(Math.abs(verifiedEnd!.sourceCoordinate - verifiedStart!.sourceCoordinate) - dimension.value) / dimension.value
      : null;
    const independentRelativeSpanError = memberRelativeSpanError ?? candidate.independentRelativeSpanError;

    let reason: BosCrossEvidenceConstraintReadinessReason = "ready_for_read_only_constraint_simulation";
    if (missingWall) reason = "missing_candidate_wall";
    else if (!supportComplete || minimumObservedSupport === null || minimumObservedSupport < minimumWallSourceSupport) reason = "insufficient_source_pixel_support";
    else if (maximumObservedBoundaryOffsetMeters > maximumBoundaryOffsetMeters) reason = "boundary_coordinate_mismatch";
    else if (independentRelativeSpanError > maximumRelativeSpanError || candidate.candidateRelativeSpanError > maximumRelativeSpanError) reason = "span_residual_too_high";

    return {
      dimensionId: item.dimensionId,
      rawText: item.rawText,
      candidateWallIds,
      startCandidateWalls,
      endCandidateWalls,
      minimumWallSourceSupport: minimumObservedSupport,
      startBoundaryOffsetMeters,
      endBoundaryOffsetMeters,
      maximumBoundaryOffsetMeters: maximumObservedBoundaryOffsetMeters,
      independentRelativeSpanError,
      memberRelativeSpanError,
      candidateRelativeSpanError: candidate.candidateRelativeSpanError,
      boundaryComparisonBasis: useVerifiedMembers ? "verified_family_member" : "family_representative",
      ready: reason === "ready_for_read_only_constraint_simulation",
      reason,
    };
  });

  const readyCount = diagnostics.filter((item) => item.ready).length;
  return {
    dimensions: diagnostics,
    readyCount,
    diagnostics: [
      `Cross-evidence constraint readiness inspected ${diagnostics.length} convergence result(s).`,
      `${readyCount} are eligible for a later read-only constraint-consumption simulation with ${(minimumWallSourceSupport * 100).toFixed(0)}% minimum direct source-pixel wall support, ${(maximumBoundaryOffsetMeters * 100).toFixed(0)} cm maximum candidate-to-source boundary offset, and ${(maximumRelativeSpanError * 100).toFixed(1)}% span residual.`,
      "A uniquely verified source-family member may replace only the clustered family representative for coordinate/thickness fidelity comparison; family selection and reconstruction remain unchanged.",
      "Candidate wall center coordinates, thicknesses, lengths, source primitive IDs, and direct pixel support are exposed read-only for any coordinate mismatch.",
      "Read-only: this gate does not add constraints, move walls, alter topology, persist geometry, or change the canonical model.",
    ],
  };
}
