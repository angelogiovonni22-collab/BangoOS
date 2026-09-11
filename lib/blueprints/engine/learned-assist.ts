import type { BosBuildingGraph } from "./building-graph";
import { scoreLearnedInferenceAgainstGraph } from "./learned-consensus";
import { applyLearnedWallRepair } from "./learned-repair";
import { isBlueprintLearnedInferenceConfigured, requestBlueprintLearnedInference } from "./python-inference";
import { DEFAULT_RASTER_LINE_OPTIONS, renderBlueprintPdfPage } from "./raster";

export type LearnedBlueprintAssistInput = {
  graph: BosBuildingGraph;
  pdfBuffer: Buffer;
  companyId?: string;
  projectId?: string;
  sourceVersionId?: string;
  sourcePage: number;
  sourceWidthUnits: number;
  sourceHeightUnits: number;
};

export type LearnedBlueprintAssistResult = {
  graph: BosBuildingGraph;
  attempted: boolean;
  accepted: boolean;
  diagnostics: string[];
};

function shouldAttempt(graph: BosBuildingGraph) {
  if (!isBlueprintLearnedInferenceConfigured()) return false;
  if (!graph.scale.drawingUnitsPerMeter || graph.scale.confidence < 0.7) return false;
  if (graph.validation.status === "reconstructed" && graph.validation.metrics.wallTopology >= 0.9) return false;
  return true;
}

/**
 * Uses learned floor-plan inference only as an evidence-backed repair proposal.
 * Deterministic geometry remains authoritative unless both consensus and post-repair
 * validation improve. Manual corrections are intentionally replayed by the caller
 * after this function returns, keeping user edits as the final authority.
 */
export async function applyLearnedBlueprintAssist(input: LearnedBlueprintAssistInput): Promise<LearnedBlueprintAssistResult> {
  const diagnostics: string[] = [];
  if (!shouldAttempt(input.graph)) {
    return { graph: input.graph, attempted: false, accepted: false, diagnostics };
  }
  if (!input.companyId || !input.sourceVersionId) {
    diagnostics.push("Learned Blueprint assistance was skipped because tenant/source identity was incomplete.");
    return { graph: input.graph, attempted: false, accepted: false, diagnostics };
  }
  if (!(input.sourceWidthUnits > 0) || !(input.sourceHeightUnits > 0)) {
    diagnostics.push("Learned Blueprint assistance was skipped because the source page coordinate frame was invalid.");
    return { graph: input.graph, attempted: false, accepted: false, diagnostics };
  }

  try {
    const png = await renderBlueprintPdfPage(
      input.pdfBuffer,
      { ...DEFAULT_RASTER_LINE_OPTIONS, maxDimension: 1800 },
      input.sourcePage,
    );
    if (png.byteLength > 30 * 1024 * 1024) {
      diagnostics.push("Learned Blueprint assistance was skipped because the rendered plan exceeded the 30 MB inference safety limit.");
      return { graph: input.graph, attempted: false, accepted: false, diagnostics };
    }

    const inference = await requestBlueprintLearnedInference({
      companyId: input.companyId,
      projectId: input.projectId,
      sourceVersionId: input.sourceVersionId,
      sourcePage: input.sourcePage,
      imageUrl: `data:image/png;base64,${png.toString("base64")}`,
      drawingUnitsPerMeter: input.graph.scale.drawingUnitsPerMeter,
      sourceWidthUnits: input.sourceWidthUnits,
      sourceHeightUnits: input.sourceHeightUnits,
    });
    if (!inference) {
      diagnostics.push("Learned Blueprint inference was unavailable or returned an invalid response; deterministic geometry was retained.");
      return { graph: input.graph, attempted: true, accepted: false, diagnostics };
    }

    const consensus = scoreLearnedInferenceAgainstGraph(input.graph, inference);
    diagnostics.push(
      `Learned Blueprint consensus scored ${consensus.score.toFixed(3)} (${consensus.status}); deterministic wall coverage ${consensus.metrics.deterministicWallCoverage.toFixed(3)}, learned wall precision ${consensus.metrics.learnedWallPrecision.toFixed(3)}.`,
    );
    if (consensus.reasons.length) diagnostics.push(`Learned consensus gate: ${consensus.reasons.join(", ")}.`);

    const repair = applyLearnedWallRepair(input.graph, inference, consensus);
    if (!repair.accepted) {
      diagnostics.push(`Learned topology proposal was withheld (${repair.reason}); deterministic geometry was retained.`);
      return { graph: input.graph, attempted: true, accepted: false, diagnostics };
    }

    diagnostics.push(
      `Learned topology repair accepted ${repair.addedWallCount} evidence-backed wall addition(s); validation improved from ${input.graph.validation.score.toFixed(3)} to ${repair.graph.validation.score.toFixed(3)} and topology from ${input.graph.validation.metrics.wallTopology.toFixed(3)} to ${repair.graph.validation.metrics.wallTopology.toFixed(3)}.`,
    );
    return { graph: repair.graph, attempted: true, accepted: true, diagnostics };
  } catch (error) {
    diagnostics.push(error instanceof Error
      ? `Learned Blueprint assistance failed closed: ${error.message}`
      : "Learned Blueprint assistance failed closed; deterministic geometry was retained.");
    return { graph: input.graph, attempted: true, accepted: false, diagnostics };
  }
}
