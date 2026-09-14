import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import { summarizeRasterMinRunParitySimulation } from "./source-pair-raster-minrun-simulation";

export function summarizeRasterRunParitySimulation(input: {
  baselineMinRunPixels: number;
  simulatedMinRunPixels: number;
  baselineGapPixels: number;
  simulatedGapPixels: number;
  baselineRasterSegmentCount: number;
  simulatedRasterSegmentCount: number;
  beforeAgreement: BosSourcePairFamilyAgreementDiagnostic;
  afterAgreement: BosSourcePairFamilyAgreementDiagnostic;
  beforeStageDiagnostic: BosRasterStageGapDiagnostic;
  afterStageDiagnostic: BosRasterStageGapDiagnostic;
}) {
  const summary = summarizeRasterMinRunParitySimulation({
    baselineMinRunPixels: input.baselineMinRunPixels,
    simulatedMinRunPixels: input.simulatedMinRunPixels,
    baselineRasterSegmentCount: input.baselineRasterSegmentCount,
    simulatedRasterSegmentCount: input.simulatedRasterSegmentCount,
    beforeAgreement: input.beforeAgreement,
    afterAgreement: input.afterAgreement,
    beforeStageDiagnostic: input.beforeStageDiagnostic,
    afterStageDiagnostic: input.afterStageDiagnostic,
  });

  return {
    ...summary,
    mode: "read_only_raster_run_parity_simulation" as const,
    baselineGapPixels: input.baselineGapPixels,
    simulatedGapPixels: input.simulatedGapPixels,
    diagnostics: [
      `Raster run-parity simulation changed only minimum contiguous run from ${input.baselineMinRunPixels} to ${input.simulatedMinRunPixels} pixels and gap bridging from ${input.baselineGapPixels} to ${input.simulatedGapPixels} pixels.`,
      ...summary.diagnostics.slice(1),
    ],
  };
}
