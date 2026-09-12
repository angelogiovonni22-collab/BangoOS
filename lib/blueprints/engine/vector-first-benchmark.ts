import type { BosRawSegment } from "./geometry";
import type { BosParsedPlan } from "./plan-parser";
import { summarizeSelectedPlan } from "./plan-parser";
import { classifyArchitecturalPrimitives, summarizePrimitiveClasses } from "./primitive-classifier";
import { buildWallSystemsFromClassifiedPrimitives } from "./wall-system-builder";
import { solveGlobalWallConstraints } from "./global-constraint-solver";
import { assessSourceGeometryAlignment } from "./source-alignment";
import { scaleSegmentsToMeters } from "./wall-detector";

export type BosVectorFirstBenchmarkAcceptance = {
  passed: boolean;
  checks: {
    targetPage: boolean;
    scale: boolean;
    minimumWallSystems: boolean;
    sourceAlignment: boolean;
    candidateSupport: boolean;
    wallFaceCoverage: boolean;
    unsupportedGeometry: boolean;
  };
  failures: string[];
};

export type BosVectorFirstBenchmarkReport = {
  selectedPage: number;
  targetScore: number;
  scale: {
    source: string;
    drawingUnitsPerMeter: number | null;
    confidence: number;
    printedLabel?: string;
  };
  vectorSegmentCount: number;
  vectorPrimitiveCount: number;
  primitiveClasses: ReturnType<typeof summarizePrimitiveClasses>;
  wallSystemCount: number;
  constrainedWallSystemCount: number;
  junctionCount: number;
  snappedEndpointCount: number;
  matchedDimensionCount: number;
  unresolvedDimensionCount: number;
  wallFacePrimitiveCoverage: number;
  sourceAlignment: ReturnType<typeof assessSourceGeometryAlignment>;
  candidateSupportRatio: number;
  unsupportedGeometryCount: number;
  thicknessMedian: number | null;
  thicknessMad: number | null;
  maxMatchedDimensionResidualMeters: number | null;
  acceptance: BosVectorFirstBenchmarkAcceptance;
};

function asCandidateSegments(
  systems: ReturnType<typeof solveGlobalWallConstraints>["wallSystems"],
): BosRawSegment[] {
  return systems.map((wall) => ({
    start: { ...wall.centerline.start },
    end: { ...wall.centerline.end },
    sourcePage: wall.sourcePage,
    sourceObjectId: wall.id,
    strokeWidth: wall.thickness,
    confidence: wall.confidence,
  }));
}

function acceptanceFor(input: {
  selectedPage: number;
  expectedPage?: number;
  scaleConfidence: number;
  wallSystemCount: number;
  alignmentScore: number;
  supportRatio: number;
  wallFaceCoverage: number;
  unsupportedGeometryCount: number;
  candidateCount: number;
}): BosVectorFirstBenchmarkAcceptance {
  const unsupportedAllowance = Math.max(1, Math.floor(input.candidateCount * 0.02));
  const checks = {
    targetPage: input.expectedPage === undefined || input.selectedPage === input.expectedPage,
    scale: input.scaleConfidence >= 0.9,
    minimumWallSystems: input.wallSystemCount >= 8,
    sourceAlignment: input.alignmentScore >= 0.9,
    candidateSupport: input.supportRatio >= 0.95,
    wallFaceCoverage: input.wallFaceCoverage >= 0.65,
    unsupportedGeometry: input.unsupportedGeometryCount <= unsupportedAllowance,
  };
  const failures: string[] = [];
  if (!checks.targetPage) failures.push(`Selected PDF page ${input.selectedPage} does not match expected page ${input.expectedPage}.`);
  if (!checks.scale) failures.push(`Printed-scale confidence ${input.scaleConfidence.toFixed(3)} is below the 0.900 benchmark gate.`);
  if (!checks.minimumWallSystems) failures.push(`Only ${input.wallSystemCount} explicit two-face wall systems were reconstructed; at least 8 are required before source-fidelity acceptance.`);
  if (!checks.sourceAlignment) failures.push(`Source alignment ${input.alignmentScore.toFixed(3)} is below the 0.900 vector-first benchmark gate.`);
  if (!checks.candidateSupport) failures.push(`Only ${(input.supportRatio * 100).toFixed(1)}% of reconstructed wall systems retain source-line support; at least 95% is required.`);
  if (!checks.wallFaceCoverage) failures.push(`Only ${(input.wallFaceCoverage * 100).toFixed(1)}% of classified wall-face primitives participate in explicit wall systems; at least 65% is required.`);
  if (!checks.unsupportedGeometry) failures.push(`${input.unsupportedGeometryCount} reconstructed wall systems lack direct source support; allowance is ${unsupportedAllowance}.`);
  return { passed: Object.values(checks).every(Boolean), checks, failures };
}

/**
 * Runs the new vector-first architecture as a read-only candidate benchmark. This function never
 * mutates canonical Building Graph state, never writes a generated model, and never creates 3D.
 */
export function evaluateVectorFirstCandidatePlan(
  plan: BosParsedPlan,
  options: { expectedPage?: number; levelId?: string } = {},
): BosVectorFirstBenchmarkReport {
  const selected = summarizeSelectedPlan(plan, options.levelId || "level-1");
  const drawingUnitsPerMeter = selected.scale.drawingUnitsPerMeter;
  if (!drawingUnitsPerMeter || drawingUnitsPerMeter <= 0) {
    const emptyAlignment = assessSourceGeometryAlignment([], []);
    return {
      selectedPage: plan.selectedPage,
      targetScore: plan.targetScore,
      scale: selected.scale,
      vectorSegmentCount: selected.vectorCount,
      vectorPrimitiveCount: selected.vectorPrimitiveCount,
      primitiveClasses: summarizePrimitiveClasses([]),
      wallSystemCount: 0,
      constrainedWallSystemCount: 0,
      junctionCount: 0,
      snappedEndpointCount: 0,
      matchedDimensionCount: 0,
      unresolvedDimensionCount: selected.dimensions.length,
      wallFacePrimitiveCoverage: 0,
      sourceAlignment: emptyAlignment,
      candidateSupportRatio: 0,
      unsupportedGeometryCount: 0,
      thicknessMedian: null,
      thicknessMad: null,
      maxMatchedDimensionResidualMeters: null,
      acceptance: acceptanceFor({
        selectedPage: plan.selectedPage,
        expectedPage: options.expectedPage,
        scaleConfidence: selected.scale.confidence,
        wallSystemCount: 0,
        alignmentScore: 0,
        supportRatio: 0,
        wallFaceCoverage: 0,
        unsupportedGeometryCount: 0,
        candidateCount: 0,
      }),
    };
  }

  const classified = classifyArchitecturalPrimitives(selected.page.vectorPrimitives || [], selected.page.text);
  const primitiveClasses = summarizePrimitiveClasses(classified);
  const wallSystems = buildWallSystemsFromClassifiedPrimitives(classified, { drawingUnitsPerMeter });
  const constrained = solveGlobalWallConstraints(wallSystems, selected.dimensions);
  const candidateSegments = asCandidateSegments(constrained.wallSystems);
  const sourceSegments = scaleSegmentsToMeters(selected.page.vectorSegments, drawingUnitsPerMeter);
  const sourceAlignment = assessSourceGeometryAlignment(candidateSegments, sourceSegments);
  const candidateSupportRatio = candidateSegments.length ? sourceAlignment.supported / candidateSegments.length : 0;
  const unsupportedGeometryCount = Math.max(0, candidateSegments.length - sourceAlignment.supported);

  const classifiedWallPrimitiveIds = new Set(
    classified.filter((item) => item.classification === "wall_face").map((item) => item.primitive.id),
  );
  const usedWallPrimitiveIds = new Set<string>();
  for (const wall of wallSystems) {
    usedWallPrimitiveIds.add(wall.faceA.primitiveId);
    usedWallPrimitiveIds.add(wall.faceB.primitiveId);
  }
  const wallFacePrimitiveCoverage = classifiedWallPrimitiveIds.size
    ? usedWallPrimitiveIds.size / classifiedWallPrimitiveIds.size
    : 0;

  const matchedDimensionResiduals = constrained.constraints
    .filter((item) => item.relation === "dimension" && typeof item.residual === "number")
    .map((item) => Math.abs(item.residual as number));
  const maxMatchedDimensionResidualMeters = matchedDimensionResiduals.length
    ? Math.max(...matchedDimensionResiduals)
    : null;

  return {
    selectedPage: plan.selectedPage,
    targetScore: plan.targetScore,
    scale: selected.scale,
    vectorSegmentCount: selected.vectorCount,
    vectorPrimitiveCount: selected.vectorPrimitiveCount,
    primitiveClasses,
    wallSystemCount: wallSystems.length,
    constrainedWallSystemCount: constrained.wallSystems.length,
    junctionCount: constrained.junctionCount,
    snappedEndpointCount: constrained.snappedEndpointCount,
    matchedDimensionCount: constrained.matchedDimensionCount,
    unresolvedDimensionCount: constrained.unresolvedDimensionIds.length,
    wallFacePrimitiveCoverage,
    sourceAlignment,
    candidateSupportRatio,
    unsupportedGeometryCount,
    thicknessMedian: constrained.thicknessMedian,
    thicknessMad: constrained.thicknessMad,
    maxMatchedDimensionResidualMeters,
    acceptance: acceptanceFor({
      selectedPage: plan.selectedPage,
      expectedPage: options.expectedPage,
      scaleConfidence: selected.scale.confidence,
      wallSystemCount: constrained.wallSystems.length,
      alignmentScore: sourceAlignment.score,
      supportRatio: candidateSupportRatio,
      wallFaceCoverage: wallFacePrimitiveCoverage,
      unsupportedGeometryCount,
      candidateCount: candidateSegments.length,
    }),
  };
}
