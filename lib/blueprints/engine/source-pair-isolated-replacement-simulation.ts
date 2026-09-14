import type { BosRawSegment } from "./geometry";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import { diagnoseSourcePairFamilyAgreement, type BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterPairingConflictDiagnostic } from "./source-pair-raster-conflict-diagnostic";
import type { BosRasterPairingGapMember } from "./source-pair-raster-pairing-gap-diagnostic";
import type { BosWallFaceEvidence, BosWallSystemCandidate } from "./wall-system-builder";

type Orientation = "horizontal" | "vertical";

type RawFace = {
  id: string;
  primitiveId: string;
  sourcePage: number;
  orientation: Orientation;
  fixed: number;
  start: number;
  end: number;
  confidence: number;
};

export type BosIsolatedPairReplacementFamilyOutcome = {
  representativePairId: string;
  candidateId: string;
  removedClaimantWallIds: string[];
  beforeReason: BosSourcePairFamilyAgreementDiagnostic["agreements"][number]["reason"];
  afterReason: BosSourcePairFamilyAgreementDiagnostic["agreements"][number]["reason"] | "missing_after_simulation";
  recoveredUnique: boolean;
};

export type BosIsolatedPairReplacementSimulation = {
  eligibleFamilyCount: number;
  simulatedFamilyCount: number;
  skippedCrossFamilyConflictCount: number;
  removedWallIds: string[];
  addedCandidateIds: string[];
  before: {
    uniqueAgreementCount: number;
    ambiguousAgreementCount: number;
    noAgreementCount: number;
    missingFamilyCount: number;
  };
  after: {
    uniqueAgreementCount: number;
    ambiguousAgreementCount: number;
    noAgreementCount: number;
    missingFamilyCount: number;
  };
  delta: {
    uniqueAgreementCount: number;
    ambiguousAgreementCount: number;
    noAgreementCount: number;
    missingFamilyCount: number;
  };
  familyOutcomes: BosIsolatedPairReplacementFamilyOutcome[];
  previouslyUniqueRegressionFamilyIds: string[];
  safeToConsiderPromotion: boolean;
  diagnostics: string[];
};

function segmentLength(segment: BosRawSegment) {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
}

function rawFaces(segments: readonly BosRawSegment[], minLengthMeters = 0.45): RawFace[] {
  return segments
    .filter((segment) => segmentLength(segment) >= minLengthMeters)
    .map((segment, index) => {
      const horizontal = Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y);
      const orientation: Orientation = horizontal ? "horizontal" : "vertical";
      const fixed = horizontal ? (segment.start.y + segment.end.y) / 2 : (segment.start.x + segment.end.x) / 2;
      const start = horizontal ? Math.min(segment.start.x, segment.end.x) : Math.min(segment.start.y, segment.end.y);
      const end = horizontal ? Math.max(segment.start.x, segment.end.x) : Math.max(segment.start.y, segment.end.y);
      const primitiveId = segment.sourceObjectId || `raster-face-${index}`;
      return {
        id: `${primitiveId}:face-${index}`,
        primitiveId,
        sourcePage: segment.sourcePage,
        orientation,
        fixed,
        start,
        end,
        confidence: segment.confidence ?? 0.62,
      };
    });
}

function faceEvidence(face: RawFace): BosWallFaceEvidence {
  const line = face.orientation === "horizontal"
    ? { start: { x: face.start, y: face.fixed }, end: { x: face.end, y: face.fixed } }
    : { start: { x: face.fixed, y: face.start }, end: { x: face.fixed, y: face.end } };
  return {
    id: face.id,
    primitiveId: face.primitiveId,
    sourcePage: face.sourcePage,
    line,
    confidence: face.confidence,
  };
}

function candidateFromFaces(candidateId: string, left: RawFace, right: RawFace): BosWallSystemCandidate | null {
  if (left.sourcePage !== right.sourcePage || left.orientation !== right.orientation) return null;
  const start = Math.max(left.start, right.start);
  const end = Math.min(left.end, right.end);
  if (end <= start) return null;
  const fixed = (left.fixed + right.fixed) / 2;
  const thickness = Math.abs(left.fixed - right.fixed);
  const horizontal = left.orientation === "horizontal";
  return {
    id: candidateId,
    sourcePage: left.sourcePage,
    centerline: horizontal
      ? { start: { x: start, y: fixed }, end: { x: end, y: fixed } }
      : { start: { x: fixed, y: start }, end: { x: fixed, y: end } },
    thickness,
    length: end - start,
    orientationRadians: horizontal ? 0 : Math.PI / 2,
    faceA: faceEvidence(left),
    faceB: faceEvidence(right),
    overlapRatio: Math.min(1, (end - start) / Math.max(0.000001, Math.min(left.end - left.start, right.end - right.start))),
    confidence: Math.min(0.98, (left.confidence + right.confidence) / 2),
  };
}

function retainedSourcePairs(
  familyAgreement: BosSourcePairFamilyAgreementDiagnostic,
  clusters: readonly BosSourceWallPairConsolidationCluster[],
): BosSourceWallFacePair[] {
  const clusterByRepresentative = new Map(clusters.map((cluster) => [cluster.representativePairId, cluster]));
  return familyAgreement.agreements.flatMap((agreement) => {
    const cluster = clusterByRepresentative.get(agreement.representativePairId);
    const representative = cluster?.members.find((member) => member.id === agreement.representativePairId);
    return representative ? [representative] : [];
  });
}

function summary(diagnostic: BosSourcePairFamilyAgreementDiagnostic) {
  return {
    uniqueAgreementCount: diagnostic.uniqueAgreementCount,
    ambiguousAgreementCount: diagnostic.ambiguousAgreementCount,
    noAgreementCount: diagnostic.noAgreementCount,
    missingFamilyCount: diagnostic.missingFamilyCount,
  };
}

/**
 * Read-only simulation for the narrowest conflict class proven by the preceding diagnostics:
 * a no-agreement source family whose greedy-lost raw candidate is singular/converged and whose
 * currently selected claimant wall(s) have no passing independent source-family support.
 *
 * The simulation removes only those unbacked claimant wall IDs and inserts the exact raw two-face
 * candidate already observed in raster evidence. It does not move, snap, average, bridge, or invent
 * geometry. Existing 2 cm coordinate/thickness and 90% source-span gates are then rerun unchanged.
 */
export function simulateIsolatedSourceBackedRasterPairReplacements(input: {
  familyAgreement: BosSourcePairFamilyAgreementDiagnostic;
  consolidationClusters: readonly BosSourceWallPairConsolidationCluster[];
  conflictProvenance: BosRasterPairingConflictDiagnostic;
  gapMembers: readonly BosRasterPairingGapMember[];
  annotationFilteredSegments: readonly BosRawSegment[];
  explicitWallSystems: readonly BosWallSystemCandidate[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
}): BosIsolatedPairReplacementSimulation {
  const faces = rawFaces(input.annotationFilteredSegments);
  const faceById = new Map(faces.map((face) => [face.id, face]));
  const gapMembersByFamily = new Map<string, BosRasterPairingGapMember[]>();
  for (const member of input.gapMembers) {
    if (member.reason !== "greedy_face_claimed_candidate") continue;
    gapMembersByFamily.set(member.representativePairId, [...(gapMembersByFamily.get(member.representativePairId) ?? []), member]);
  }

  const eligible = input.conflictProvenance.families.filter((family) => family.reason === "isolated_unbacked_candidate");
  const specs: Array<{
    representativePairId: string;
    candidateId: string;
    claimantWallIds: string[];
    candidate: BosWallSystemCandidate;
    candidateFaceIds: string[];
  }> = [];
  for (const family of eligible) {
    const candidateId = family.distinctBestCandidateIds[0];
    if (!candidateId) continue;
    const matchingMember = (gapMembersByFamily.get(family.representativePairId) ?? []).find((member) => member.bestCandidateId === candidateId);
    if (!matchingMember || matchingMember.bestCandidateFaceIds.length !== 2) continue;
    const left = faceById.get(matchingMember.bestCandidateFaceIds[0]);
    const right = faceById.get(matchingMember.bestCandidateFaceIds[1]);
    if (!left || !right) continue;
    const candidate = candidateFromFaces(candidateId, left, right);
    if (!candidate) continue;
    specs.push({
      representativePairId: family.representativePairId,
      candidateId,
      claimantWallIds: [...family.claimantWallIds],
      candidate,
      candidateFaceIds: [...matchingMember.bestCandidateFaceIds],
    });
  }

  const conflictedFamilies = new Set<string>();
  for (let left = 0; left < specs.length; left += 1) {
    for (let right = left + 1; right < specs.length; right += 1) {
      const a = specs[left];
      const b = specs[right];
      const sharesClaimant = a.claimantWallIds.some((wallId) => b.claimantWallIds.includes(wallId));
      const sharesCandidateFace = a.candidateFaceIds.some((faceId) => b.candidateFaceIds.includes(faceId));
      if (sharesClaimant || sharesCandidateFace) {
        conflictedFamilies.add(a.representativePairId);
        conflictedFamilies.add(b.representativePairId);
      }
    }
  }
  const simulatedSpecs = specs.filter((spec) => !conflictedFamilies.has(spec.representativePairId));
  const removeIds = new Set(simulatedSpecs.flatMap((spec) => spec.claimantWallIds));
  const simulatedWalls = [
    ...input.explicitWallSystems.filter((wall) => !removeIds.has(wall.id)),
    ...simulatedSpecs.map((spec) => spec.candidate),
  ];

  const retainedPairs = retainedSourcePairs(input.familyAgreement, input.consolidationClusters);
  const afterAgreement = diagnoseSourcePairFamilyAgreement({
    retainedSourcePairs: retainedPairs,
    consolidationClusters: input.consolidationClusters,
    explicitWallSystems: simulatedWalls,
    sourcePixelWidth: input.sourcePixelWidth,
    sourcePixelHeight: input.sourcePixelHeight,
    sourceWidthMeters: input.sourceWidthMeters,
    sourceHeightMeters: input.sourceHeightMeters,
  });
  const beforeByFamily = new Map(input.familyAgreement.agreements.map((agreement) => [agreement.representativePairId, agreement]));
  const afterByFamily = new Map(afterAgreement.agreements.map((agreement) => [agreement.representativePairId, agreement]));
  const familyOutcomes = simulatedSpecs.map((spec) => {
    const beforeReason = beforeByFamily.get(spec.representativePairId)?.reason ?? "missing_family";
    const afterReason = afterByFamily.get(spec.representativePairId)?.reason ?? "missing_after_simulation";
    return {
      representativePairId: spec.representativePairId,
      candidateId: spec.candidateId,
      removedClaimantWallIds: spec.claimantWallIds,
      beforeReason,
      afterReason,
      recoveredUnique: beforeReason === "no_family_member_agreement" && afterReason === "unique_family_member_agreement",
    } satisfies BosIsolatedPairReplacementFamilyOutcome;
  });
  const previouslyUniqueRegressionFamilyIds = input.familyAgreement.agreements
    .filter((agreement) => agreement.reason === "unique_family_member_agreement")
    .filter((agreement) => afterByFamily.get(agreement.representativePairId)?.reason !== "unique_family_member_agreement")
    .map((agreement) => agreement.representativePairId);
  const before = summary(input.familyAgreement);
  const after = summary(afterAgreement);
  const recoveredAllSimulatedFamilies = familyOutcomes.length > 0 && familyOutcomes.every((outcome) => outcome.recoveredUnique);
  const safeToConsiderPromotion = simulatedSpecs.length > 0
    && recoveredAllSimulatedFamilies
    && previouslyUniqueRegressionFamilyIds.length === 0
    && after.ambiguousAgreementCount <= before.ambiguousAgreementCount
    && after.noAgreementCount < before.noAgreementCount;

  return {
    eligibleFamilyCount: eligible.length,
    simulatedFamilyCount: simulatedSpecs.length,
    skippedCrossFamilyConflictCount: conflictedFamilies.size,
    removedWallIds: [...removeIds].sort(),
    addedCandidateIds: simulatedSpecs.map((spec) => spec.candidateId).sort(),
    before,
    after,
    delta: {
      uniqueAgreementCount: after.uniqueAgreementCount - before.uniqueAgreementCount,
      ambiguousAgreementCount: after.ambiguousAgreementCount - before.ambiguousAgreementCount,
      noAgreementCount: after.noAgreementCount - before.noAgreementCount,
      missingFamilyCount: after.missingFamilyCount - before.missingFamilyCount,
    },
    familyOutcomes,
    previouslyUniqueRegressionFamilyIds,
    safeToConsiderPromotion,
    diagnostics: [
      `Isolated pairing replacement simulation found ${eligible.length} provenance-eligible family/families and safely simulated ${simulatedSpecs.length}; ${conflictedFamilies.size} family/families were skipped because isolated simulations shared a claimant wall or raw candidate face.`,
      `The simulation removes only currently selected claimant wall(s) with no passing independent source-family support and inserts the exact raw two-face raster candidate already observed by the unchanged hard source gates.`,
      `${familyOutcomes.filter((outcome) => outcome.recoveredUnique).length} simulated family/families recovered unique existing-source agreement; ${previouslyUniqueRegressionFamilyIds.length} previously unique family/families regressed.`,
      safeToConsiderPromotion
        ? "Simulation evidence is internally non-regressive at the source-family agreement layer; promotion still requires independent source-overlay, topology, dimension, and full fidelity validation before any production pairing behavior may change."
        : "Simulation remains fail-closed: source-family evidence is not sufficient for promotion.",
      "Read-only simulation: production pairing, source selection, geometry, thresholds, topology, persistence, canonical data, and 3D output are unchanged.",
    ],
  };
}
