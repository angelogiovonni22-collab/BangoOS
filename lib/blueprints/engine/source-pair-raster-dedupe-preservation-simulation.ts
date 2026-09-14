import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import { summarizeRasterMinRunParitySimulation } from "./source-pair-raster-minrun-simulation";

/**
 * Compares production longest-per-band raster de-duplication with a read-only keep-all extraction.
 * All raster run, gap, source-family coordinate, thickness, and span thresholds remain unchanged.
 * The summary is deliberately conservative: any regression of an already unique family prevents
 * consideration for a future narrower de-duplication strategy.
 */
export function summarizeRasterDedupePreservationSimulation(input: {
  rasterMinRunPixels: number;
  baselineRasterSegmentCount: number;
  simulatedRasterSegmentCount: number;
  beforeAgreement: BosSourcePairFamilyAgreementDiagnostic;
  afterAgreement: BosSourcePairFamilyAgreementDiagnostic;
  beforeStageDiagnostic: BosRasterStageGapDiagnostic;
  afterStageDiagnostic: BosRasterStageGapDiagnostic;
}) {
  const summary = summarizeRasterMinRunParitySimulation({
    baselineMinRunPixels: input.rasterMinRunPixels,
    simulatedMinRunPixels: input.rasterMinRunPixels,
    baselineRasterSegmentCount: input.baselineRasterSegmentCount,
    simulatedRasterSegmentCount: input.simulatedRasterSegmentCount,
    beforeAgreement: input.beforeAgreement,
    afterAgreement: input.afterAgreement,
    beforeStageDiagnostic: input.beforeStageDiagnostic,
    afterStageDiagnostic: input.afterStageDiagnostic,
  });

  return {
    ...summary,
    mode: "read_only_raster_dedupe_preservation_simulation" as const,
    baselineDedupeMode: "longest_per_band" as const,
    simulatedDedupeMode: "keep_all" as const,
    diagnostics: [
      `Raster de-duplication preservation simulation kept the unchanged ${input.rasterMinRunPixels}-pixel minimum, run-gap behavior, and every hard source-family fidelity gate.`,
      `Only post-run de-duplication changed in simulation from production longest-per-band to keep-all; raster segment count changed from ${input.baselineRasterSegmentCount} to ${input.simulatedRasterSegmentCount}.`,
      `${summary.newlyUniqueFamilyIds.length} family/families became uniquely supported and ${summary.previouslyUniqueRegressionFamilyIds.length} previously unique family/families regressed.`,
      `No-matching extraction-face gaps changed from ${input.beforeStageDiagnostic.reasonMemberCounts.extraction_face_coverage_gap} to ${input.afterStageDiagnostic.reasonMemberCounts.extraction_face_coverage_gap} member(s).`,
      summary.safeToConsiderPromotion
        ? "The broad keep-all simulation is non-regressive at the source-family layer; this is evidence only for designing a narrower source-supported de-duplication strategy, not authorization to change production extraction."
        : "The broad keep-all simulation is not safe for promotion; production de-duplication must remain unchanged and any future recovery must be narrower and source-supported.",
      "Read-only simulation: no production raster setting, segment, wall, topology, persistence, canonical geometry, or 3D output changed.",
    ],
  };
}
