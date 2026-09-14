import type { BosWallSystemCandidate } from "./wall-system-builder";
import type { BosIndependentBoundaryFamily, BosIndependentDimensionBoundaryDiagnostic } from "./source-network-dimension-endpoint-diagnostic";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";

export type BosSourceFamilyMemberAgreementReason =
  | "unique_member_agreement"
  | "missing_selected_source_family"
  | "missing_candidate_wall"
  | "no_member_within_fidelity_targets"
  | "ambiguous_member_agreement";

export type BosSourceFamilyMemberAgreementMatch = {
  wallId: string;
  pairIds: string[];
  candidateCoordinate: number;
  sourceCoordinate: number;
  coordinateErrorMeters: number;
  candidateThicknessMeters: number;
  sourceSeparationMeters: number;
  thicknessErrorMeters: number;
};

export type BosSourceFamilyMemberEndpointAgreement = {
  endpoint: "start" | "end";
  familyRepresentativeCoordinate: number;
  familyRepresentativePairId: string | null;
  candidateWallIds: string[];
  eligibleMatches: BosSourceFamilyMemberAgreementMatch[];
  recommendedMatch: BosSourceFamilyMemberAgreementMatch | null;
  reason: BosSourceFamilyMemberAgreementReason;
};

export type BosSourceFamilyMemberAgreementDiagnostic = {
  dimensionId: string;
  rawText: string;
  start: BosSourceFamilyMemberEndpointAgreement;
  end: BosSourceFamilyMemberEndpointAgreement;
  ready: boolean;
  reason: "unique_both_endpoints" | "endpoint_member_agreement_unresolved";
};

function fixedCoordinate(wall: BosWallSystemCandidate) {
  const dx = Math.abs(wall.centerline.end.x - wall.centerline.start.x);
  const dy = Math.abs(wall.centerline.end.y - wall.centerline.start.y);
  return dy >= dx
    ? (wall.centerline.start.x + wall.centerline.end.x) / 2
    : (wall.centerline.start.y + wall.centerline.end.y) / 2;
}

function selectedFamily(families: readonly BosIndependentBoundaryFamily[], coordinate: number) {
  const nearest = [...families].sort((a, b) => Math.abs(a.coordinate - coordinate) - Math.abs(b.coordinate - coordinate))[0];
  return nearest && Math.abs(nearest.coordinate - coordinate) <= 0.001 ? nearest : null;
}

function diagnoseEndpoint(input: {
  endpoint: "start" | "end";
  independentCoordinate: number;
  candidateWallIds: readonly string[];
  families: readonly BosIndependentBoundaryFamily[];
  wallById: ReadonlyMap<string, BosWallSystemCandidate>;
  maximumCoordinateErrorMeters: number;
  maximumThicknessErrorMeters: number;
  equivalentSourceGeometryToleranceMeters: number;
}): BosSourceFamilyMemberEndpointAgreement {
  const family = selectedFamily(input.families, input.independentCoordinate);
  const base = {
    endpoint: input.endpoint,
    familyRepresentativeCoordinate: input.independentCoordinate,
    familyRepresentativePairId: family?.representativePairId ?? null,
    candidateWallIds: [...input.candidateWallIds],
  };
  if (!family) return { ...base, eligibleMatches: [], recommendedMatch: null, reason: "missing_selected_source_family" };
  const walls = input.candidateWallIds.map((id) => input.wallById.get(id)).filter((wall): wall is BosWallSystemCandidate => Boolean(wall));
  if (walls.length !== input.candidateWallIds.length) return { ...base, eligibleMatches: [], recommendedMatch: null, reason: "missing_candidate_wall" };

  const rawMatches = walls.flatMap((wall) => family.members.flatMap((member) => {
    const candidateCoordinate = fixedCoordinate(wall);
    const coordinateErrorMeters = Math.abs(candidateCoordinate - member.coordinate);
    const thicknessErrorMeters = Math.abs(wall.thickness - member.separationMeters);
    if (coordinateErrorMeters > input.maximumCoordinateErrorMeters || thicknessErrorMeters > input.maximumThicknessErrorMeters) return [];
    return [{
      wallId: wall.id,
      pairId: member.pairId,
      candidateCoordinate,
      sourceCoordinate: member.coordinate,
      coordinateErrorMeters,
      candidateThicknessMeters: wall.thickness,
      sourceSeparationMeters: member.separationMeters,
      thicknessErrorMeters,
    }];
  })).sort((a, b) =>
    (a.coordinateErrorMeters + a.thicknessErrorMeters) - (b.coordinateErrorMeters + b.thicknessErrorMeters)
    || a.wallId.localeCompare(b.wallId)
    || a.pairId.localeCompare(b.pairId));

  const eligibleMatches: BosSourceFamilyMemberAgreementMatch[] = [];
  for (const raw of rawMatches) {
    const equivalent = eligibleMatches.find((match) =>
      match.wallId === raw.wallId
      && Math.abs(match.sourceCoordinate - raw.sourceCoordinate) <= input.equivalentSourceGeometryToleranceMeters
      && Math.abs(match.sourceSeparationMeters - raw.sourceSeparationMeters) <= input.equivalentSourceGeometryToleranceMeters);
    if (equivalent) {
      equivalent.pairIds.push(raw.pairId);
      continue;
    }
    eligibleMatches.push({
      wallId: raw.wallId,
      pairIds: [raw.pairId],
      candidateCoordinate: raw.candidateCoordinate,
      sourceCoordinate: raw.sourceCoordinate,
      coordinateErrorMeters: raw.coordinateErrorMeters,
      candidateThicknessMeters: raw.candidateThicknessMeters,
      sourceSeparationMeters: raw.sourceSeparationMeters,
      thicknessErrorMeters: raw.thicknessErrorMeters,
    });
  }
  for (const match of eligibleMatches) match.pairIds.sort();
  eligibleMatches.sort((a, b) =>
    (a.coordinateErrorMeters + a.thicknessErrorMeters) - (b.coordinateErrorMeters + b.thicknessErrorMeters)
    || a.wallId.localeCompare(b.wallId)
    || a.pairIds[0].localeCompare(b.pairIds[0]));

  if (!eligibleMatches.length) return { ...base, eligibleMatches, recommendedMatch: null, reason: "no_member_within_fidelity_targets" };
  if (eligibleMatches.length > 1) return { ...base, eligibleMatches, recommendedMatch: null, reason: "ambiguous_member_agreement" };
  return { ...base, eligibleMatches, recommendedMatch: eligibleMatches[0], reason: "unique_member_agreement" };
}

/**
 * Read-only diagnostic that checks whether a uniquely converged reconstructed boundary agrees with
 * one retained source-family geometry in both center coordinate and two-face separation. Multiple
 * retained source pairs with the same fixed coordinate and separation are treated as one boundary
 * geometry rather than false ambiguity; materially different source geometries still fail closed.
 */
export function diagnoseSourceFamilyMemberAgreement(input: {
  convergence: readonly BosCrossEvidenceBoundaryConvergenceDiagnostic[];
  independentDiagnostics: readonly BosIndependentDimensionBoundaryDiagnostic[];
  wallSystems: readonly BosWallSystemCandidate[];
  maximumCoordinateErrorMeters?: number;
  maximumThicknessErrorMeters?: number;
  equivalentSourceGeometryToleranceMeters?: number;
}) {
  const maximumCoordinateErrorMeters = input.maximumCoordinateErrorMeters ?? 0.02;
  const maximumThicknessErrorMeters = input.maximumThicknessErrorMeters ?? 0.02;
  const equivalentSourceGeometryToleranceMeters = input.equivalentSourceGeometryToleranceMeters ?? 0.001;
  const independentById = new Map(input.independentDiagnostics.map((item) => [item.dimensionId, item]));
  const wallById = new Map(input.wallSystems.map((wall) => [wall.id, wall]));
  const dimensions: BosSourceFamilyMemberAgreementDiagnostic[] = [];

  for (const convergence of input.convergence) {
    if (convergence.reason !== "unique_cross_evidence_boundary_pair" || convergence.candidates.length !== 1) continue;
    const candidate = convergence.candidates[0];
    const independent = independentById.get(convergence.dimensionId);
    if (!independent) continue;
    const start = diagnoseEndpoint({
      endpoint: "start",
      independentCoordinate: candidate.independentStartCoordinate,
      candidateWallIds: candidate.candidateStartWallIds,
      families: independent.startFamilies,
      wallById,
      maximumCoordinateErrorMeters,
      maximumThicknessErrorMeters,
      equivalentSourceGeometryToleranceMeters,
    });
    const end = diagnoseEndpoint({
      endpoint: "end",
      independentCoordinate: candidate.independentEndCoordinate,
      candidateWallIds: candidate.candidateEndWallIds,
      families: independent.endFamilies,
      wallById,
      maximumCoordinateErrorMeters,
      maximumThicknessErrorMeters,
      equivalentSourceGeometryToleranceMeters,
    });
    const ready = start.reason === "unique_member_agreement" && end.reason === "unique_member_agreement";
    dimensions.push({
      dimensionId: convergence.dimensionId,
      rawText: convergence.rawText,
      start,
      end,
      ready,
      reason: ready ? "unique_both_endpoints" : "endpoint_member_agreement_unresolved",
    });
  }

  const readyCount = dimensions.filter((item) => item.ready).length;
  return {
    dimensions,
    readyCount,
    diagnostics: [
      `Source-family member agreement inspected ${dimensions.length} uniquely converged dimension(s).`,
      `${readyCount} agree with exactly one retained source-family boundary geometry at both endpoints within ${(maximumCoordinateErrorMeters * 100).toFixed(0)} cm coordinate and ${(maximumThicknessErrorMeters * 100).toFixed(0)} cm thickness targets.`,
      `Equivalent source pairs are collapsed only when fixed coordinate and separation agree within ${(equivalentSourceGeometryToleranceMeters * 1000).toFixed(0)} mm.`,
      "Read-only: the existing source-family representative and all reconstruction, constraint, and canonical geometry remain unchanged.",
    ],
  };
}
