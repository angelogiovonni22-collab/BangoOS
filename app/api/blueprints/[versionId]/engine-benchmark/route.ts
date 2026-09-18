import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import { parsePdfVectorPlan } from "@/lib/blueprints/engine/pdf-vector-parser";
import { normalizeParsedPlan, summarizeSelectedPlan } from "@/lib/blueprints/engine/plan-parser";
import { evaluateVectorFirstCandidatePlan } from "@/lib/blueprints/engine/vector-first-benchmark";
import { extractRasterLineSegments } from "@/lib/blueprints/engine/raster";
import { buildRasterArchitecturalCandidate } from "@/lib/blueprints/engine/raster-architectural-candidate";
import { evaluateRasterEvidenceStages } from "@/lib/blueprints/engine/raster-evidence-benchmark";
import { assessSourcePixelOverlay, renderBlueprintGraySource } from "@/lib/blueprints/engine/source-pixel-overlay";
import { assessSourceWallNetworkOverlay, buildIndependentSourceWallNetworkEvidence } from "@/lib/blueprints/engine/source-wall-network-overlay";
import { diagnoseIndependentSourceDimensionBoundaries } from "@/lib/blueprints/engine/source-network-dimension-endpoint-diagnostic";
import { diagnoseCrossEvidenceBoundaryConvergence } from "@/lib/blueprints/engine/cross-evidence-boundary-convergence-diagnostic";
import { diagnoseCrossEvidenceConstraintReadiness } from "@/lib/blueprints/engine/cross-evidence-constraint-readiness-diagnostic";
import { diagnoseSourceFamilyMemberAgreement } from "@/lib/blueprints/engine/source-family-member-agreement-diagnostic";
import { simulateReadOnlyDimensionConstraints } from "@/lib/blueprints/engine/read-only-dimension-constraint-simulation";
import { diagnoseSourceBackedStructuralRecovery } from "@/lib/blueprints/engine/source-backed-structural-recovery-diagnostic";
import { auditResidualSourcePairs } from "@/lib/blueprints/engine/residual-source-pair-audit";
import { auditBlueprintPhaseFidelity } from "@/lib/blueprints/engine/phase-fidelity-audit";
import type { Database } from "@/types/database.types";

export const maxDuration = 120;
export const dynamic = "force-dynamic";
const MAX_SOURCE_BYTES = 45 * 1024 * 1024;

function dbClient(supabase: SupabaseClient<Database>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function numericField(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const supabase = await createClient();
    if (!supabase) throw new Error("B.O.S. database is unavailable.");
    const typed = supabase as SupabaseClient<Database>;
    const workspace = await resolveWorkspaceContext(typed);
    if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
    const db = dbClient(typed);

    const versionResponse = await db.from("blueprint_versions")
      .select("id,company_id,project_id,blueprint_sheet_id,storage_path,original_filename,mime_type,file_size_bytes")
      .eq("id", versionId)
      .eq("company_id", workspace.context.companyId)
      .maybeSingle();
    if (versionResponse.error) throw new Error(versionResponse.error.message);
    if (!versionResponse.data) throw new Error("Blueprint revision not found.");
    if (versionResponse.data.mime_type !== "application/pdf") return NextResponse.json({ error: "Blueprint engine benchmark currently requires a PDF Blueprint." }, { status: 415 });
    const fileSize = Number(versionResponse.data.file_size_bytes || 0);
    if (fileSize <= 0 || fileSize > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Blueprint source is outside the safe read-only benchmark size limit." }, { status: 413 });

    const sheetResponse = await db.from("blueprint_sheets")
      .select("sheet_number,title,discipline")
      .eq("id", versionResponse.data.blueprint_sheet_id)
      .eq("company_id", workspace.context.companyId)
      .maybeSingle();
    if (sheetResponse.error) throw new Error(sheetResponse.error.message);
    if (!sheetResponse.data) throw new Error("Blueprint sheet metadata not found.");

    const sourceDownload = await typed.storage.from(BLUEPRINTS_BUCKET).download(versionResponse.data.storage_path);
    if (sourceDownload.error || !sourceDownload.data) throw new Error(sourceDownload.error?.message || "Unable to read the source Blueprint.");
    const buffer = Buffer.from(await sourceDownload.data.arrayBuffer());
    const pages = await parsePdfVectorPlan(buffer);
    const plan = normalizeParsedPlan({
      sourceType: "pdf",
      pages,
      target: {
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        title: String(sheetResponse.data.title || ""),
        discipline: String(sheetResponse.data.discipline || "Architectural"),
      },
    });

    const url = new URL(request.url);
    const expectedPageParam = Number(url.searchParams.get("expectedPage"));
    const expectedPage = Number.isInteger(expectedPageParam) && expectedPageParam > 0 ? expectedPageParam : undefined;
    const includeDimensionSweep = url.searchParams.get("dimensionSweep") === "1";
    const benchmark = evaluateVectorFirstCandidatePlan(plan, { expectedPage });
    const selected = summarizeSelectedPlan(plan, "level-1");

    let rasterEvidence = null;
    let unsupportedHighConfidenceWallCount: number | null = null;
    if ((selected.rasterRequired || selected.vectorCount === 0) && selected.scale.drawingUnitsPerMeter && selected.scale.confidence >= 0.55) {
      const raster = await extractRasterLineSegments(buffer, {
        page: plan.selectedPage,
        drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
        sourceWidth: selected.page.width,
        sourceHeight: selected.page.height,
      });
      const architecturalCandidate = buildRasterArchitecturalCandidate({
        segments: raster.segments,
        dimensions: selected.dimensions,
        drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const dimensionEvidenceOptionSweep = includeDimensionSweep
        ? [
            { id: "baseline", options: undefined },
            { id: "label-distance-1.50m", options: { maxLabelDistanceMeters: 1.5 } },
            { id: "ambiguity-gap-0.04", options: { ambiguityScoreGap: 0.04 } },
            { id: "label-1.50m-ambiguity-0.04", options: { maxLabelDistanceMeters: 1.5, ambiguityScoreGap: 0.04 } },
          ].map((variant) => {
            const candidate = variant.id === "baseline"
              ? architecturalCandidate
              : buildRasterArchitecturalCandidate({
                  segments: raster.segments,
                  dimensions: selected.dimensions,
                  drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter!,
                  sourceWidthMeters: raster.width,
                  sourceHeightMeters: raster.height,
                  dimensionEvidenceOptions: variant.options,
                });
            return {
              id: variant.id,
              options: variant.options ?? {},
              sourceAssociationCount: candidate.dimensionEvidence.associations.length,
              unresolvedSourceAssociationCount: candidate.dimensionEvidence.unresolvedDimensionIds.length,
              singleSegmentAssociationCount: candidate.dimensionEvidence.singleSegmentAssociationCount,
              labelGapChainAssociationCount: candidate.dimensionEvidence.labelGapChainAssociationCount,
              fragmentChainAssociationCount: candidate.dimensionEvidence.fragmentChainAssociationCount,
              witnessSpanAssociationCount: candidate.dimensionEvidence.witnessSpanAssociationCount,
              matchedGlobalDimensionCount: candidate.constrained.matchedDimensionCount,
              unresolvedGlobalDimensionCount: candidate.constrained.unresolvedDimensionIds.length,
            };
          })
        : null;
      const stages = evaluateRasterEvidenceStages({
        segments: raster.segments,
        dimensions: selected.dimensions,
        drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const sourceImage = await renderBlueprintGraySource(buffer, plan.selectedPage);
      const sourcePixelOverlay = assessSourcePixelOverlay({
        image: sourceImage,
        wallSystems: architecturalCandidate.constrained.wallSystems,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const supportByWallId = new Map(sourcePixelOverlay.perWallSupport.map((item) => [item.wallSystemId, item.support]));
      unsupportedHighConfidenceWallCount = architecturalCandidate.constrained.wallSystems.filter((wall) =>
        wall.confidence >= 0.8 && (supportByWallId.get(wall.id) ?? 0) < 0.95).length;
      const independentSourceWallNetwork = buildIndependentSourceWallNetworkEvidence({
        image: sourceImage,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const sourceWallNetworkOverlay = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems: architecturalCandidate.constrained.wallSystems,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
        predictedPrecision: sourcePixelOverlay.predictedPrecision,
        evidence: independentSourceWallNetwork,
      });
      const preselectionOverlay = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
        predictedPrecision: sourcePixelOverlay.predictedPrecision,
        evidence: independentSourceWallNetwork,
      });
      const sourceWallNetworkPreselectionCoverage = {
        explicitWallSystemCount: architecturalCandidate.sheetFrameSelection.wallSystems.length,
        retainedSourcePairCount: preselectionOverlay.retainedPairCount,
        recall: preselectionOverlay.recall,
        f1: preselectionOverlay.f1,
        fullyCoveredPairCount: preselectionOverlay.coverageGaps.fullyCoveredPairCount,
        partiallyCoveredPairCount: preselectionOverlay.coverageGaps.partiallyCoveredPairCount,
        uncoveredPairCount: preselectionOverlay.coverageGaps.uncoveredPairCount,
        uncoveredLengthRatio: preselectionOverlay.coverageGaps.uncoveredLengthRatio,
        diagnostics: [
          `Preselection explicit wall systems cover ${(preselectionOverlay.recall * 100).toFixed(1)}% of retained independent source-wall pixels before structural component filtering.`,
          "Read-only comparison: this does not change source-network selection, structural selection, reconstructed geometry, or canonical data.",
        ],
      };
      const residualSourcePairAudit = auditResidualSourcePairs({
        retainedSourcePairs: independentSourceWallNetwork.network.wallFacePairs,
        explicitWallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const preselectionPixelOverlay = assessSourcePixelOverlay({
        image: sourceImage,
        wallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const preselectionSupportByWallId = new Map(preselectionPixelOverlay.perWallSupport.map((item) => [item.wallSystemId, item.support]));
      const sourceBackedStructuralRecovery = diagnoseSourceBackedStructuralRecovery({
        preselectionWallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
        selectedWallSystems: architecturalCandidate.structuralSelection.wallSystems,
        retainedSourcePairs: independentSourceWallNetwork.network.wallFacePairs,
        directSourceSupportByWallId: preselectionSupportByWallId,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const recoveryIds = new Set(sourceBackedStructuralRecovery.uniquelyRecoverableWallIds);
      const recoveredWallSystems = architecturalCandidate.sheetFrameSelection.wallSystems.filter((wall) => recoveryIds.has(wall.id));
      const sourceBackedStructuralRecoverySimulation = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems: [...architecturalCandidate.constrained.wallSystems, ...recoveredWallSystems],
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
        predictedPrecision: sourcePixelOverlay.predictedPrecision,
        evidence: independentSourceWallNetwork,
      });
      const independentDimensionBoundaryEvidence = diagnoseIndependentSourceDimensionBoundaries({
        dimensions: architecturalCandidate.dimensionEvidence.dimensions,
        associations: architecturalCandidate.dimensionEvidence.associations,
        dimensionIds: new Set(stages.globalBoundaryDiagnostics.filter((diagnostic) => diagnostic.reason !== "matched_global_constraint").map((diagnostic) => diagnostic.dimensionId)),
        wallFacePairs: independentSourceWallNetwork.network.wallFacePairs,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const crossEvidenceBoundaryConvergence = diagnoseCrossEvidenceBoundaryConvergence({
        dimensions: architecturalCandidate.dimensionEvidence.dimensions,
        independentDiagnostics: independentDimensionBoundaryEvidence.dimensions,
        provenance: stages.boundaryFamilyProvenance,
        wallFacePairs: independentSourceWallNetwork.network.wallFacePairs,
      });
      const sourceFamilyMemberAgreement = diagnoseSourceFamilyMemberAgreement({
        convergence: crossEvidenceBoundaryConvergence.dimensions,
        independentDiagnostics: independentDimensionBoundaryEvidence.dimensions,
        wallSystems: architecturalCandidate.constrained.wallSystems,
      });
      const crossEvidenceConstraintReadiness = diagnoseCrossEvidenceConstraintReadiness({
        convergence: crossEvidenceBoundaryConvergence.dimensions,
        wallSystems: architecturalCandidate.constrained.wallSystems,
        sourcePixelOverlay,
        sourceFamilyMemberAgreement: sourceFamilyMemberAgreement.dimensions,
        dimensions: architecturalCandidate.dimensionEvidence.dimensions,
      });
      const readOnlyDimensionConstraintSimulation = simulateReadOnlyDimensionConstraints({
        dimensions: architecturalCandidate.dimensionEvidence.dimensions,
        readiness: crossEvidenceConstraintReadiness.dimensions,
        convergence: crossEvidenceBoundaryConvergence.dimensions,
        wallSystems: architecturalCandidate.constrained.wallSystems,
      });
      rasterEvidence = {
        extraction: { widthMeters: raster.width, heightMeters: raster.height, sourcePixelWidth: sourceImage.width, sourcePixelHeight: sourceImage.height, diagnostics: raster.diagnostics },
        stages,
        dimensionEvidenceOptionSweep,
        sourcePixelOverlay,
        sourceWallNetworkOverlay,
        sourceWallNetworkPreselectionCoverage,
        residualSourcePairAudit,
        sourceBackedStructuralRecovery,
        sourceBackedStructuralRecoverySimulation: {
          recoveredWallCount: recoveredWallSystems.length,
          recall: sourceBackedStructuralRecoverySimulation.recall,
          f1: sourceBackedStructuralRecoverySimulation.f1,
          fullyCoveredPairCount: sourceBackedStructuralRecoverySimulation.coverageGaps.fullyCoveredPairCount,
          partiallyCoveredPairCount: sourceBackedStructuralRecoverySimulation.coverageGaps.partiallyCoveredPairCount,
          uncoveredPairCount: sourceBackedStructuralRecoverySimulation.coverageGaps.uncoveredPairCount,
          uncoveredLengthRatio: sourceBackedStructuralRecoverySimulation.coverageGaps.uncoveredLengthRatio,
          diagnostics: [
            ...sourceBackedStructuralRecoverySimulation.diagnostics,
            "Simulation only: recovered wall systems are not promoted, constrained, persisted, or added to canonical geometry.",
          ],
        },
        independentDimensionBoundaryEvidence,
        crossEvidenceBoundaryConvergence,
        sourceFamilyMemberAgreement,
        crossEvidenceConstraintReadiness,
        readOnlyDimensionConstraintSimulation,
      };
    }

    const canonicalResponse = await db.from("blueprint_generated_models")
      .select("id,engine_status,status,reconstruction_version,source_page,validation_report,building_graph,updated_at")
      .eq("company_id", workspace.context.companyId)
      .eq("source_version_id", versionId)
      .maybeSingle();
    if (canonicalResponse.error) throw new Error(canonicalResponse.error.message);
    const canonical = canonicalResponse.data as Record<string, unknown> | null;
    const graph = canonical?.building_graph && typeof canonical.building_graph === "object" ? canonical.building_graph as Record<string, unknown> : null;
    const validation = canonical?.validation_report && typeof canonical.validation_report === "object" ? canonical.validation_report as Record<string, unknown> : null;
    const validationMetrics = validation?.metrics && typeof validation.metrics === "object" ? validation.metrics as Record<string, unknown> : null;

    const verifiedBoundaryMatches = rasterEvidence?.sourceFamilyMemberAgreement.dimensions.flatMap((dimension) =>
      [dimension.start.recommendedMatch, dimension.end.recommendedMatch].filter((match): match is NonNullable<typeof match> => Boolean(match))) ?? [];
    const simulatedDimensions = rasterEvidence?.readOnlyDimensionConstraintSimulation.dimensions.filter((dimension) => dimension.reason === "simulated_dimension_constraint") ?? [];
    const simulatedDimensionIds = new Set(simulatedDimensions.map((dimension) => dimension.dimensionId));
    const unresolvedSourceResolvedDimensionCount = rasterEvidence?.stages.dimensionDiagnostics.filter((dimension) =>
      dimension.reason === "source_axis_resolved_global_unmatched" && !simulatedDimensionIds.has(dimension.dimensionId)).length ?? 0;
    const maximum = (values: number[]) => values.length ? Math.max(...values) : null;
    const phaseFidelityAudit = auditBlueprintPhaseFidelity({
      sourceAlignment: numericField(validationMetrics, "sourceAlignment"),
      sourceNetworkRecall: rasterEvidence?.sourceWallNetworkOverlay.recall ?? null,
      wallTopology: numericField(validationMetrics, "wallTopology"),
      exteriorClosure: numericField(validationMetrics, "exteriorClosure"),
      verifiedBoundaryCount: rasterEvidence?.sourceFamilyMemberAgreement.readyCount ?? 0,
      verifiedBoundaryFailureCount: rasterEvidence?.sourceFamilyMemberAgreement.dimensions.filter((dimension) => !dimension.ready).length ?? 0,
      maximumVerifiedBoundaryCoordinateErrorMeters: maximum(verifiedBoundaryMatches.map((match) => match.coordinateErrorMeters)),
      maximumVerifiedBoundaryThicknessErrorMeters: maximum(verifiedBoundaryMatches.map((match) => match.thicknessErrorMeters)),
      simulatedDimensionCount: rasterEvidence?.readOnlyDimensionConstraintSimulation.simulatedConstraintCount ?? 0,
      maximumSimulatedDimensionResidual: maximum(simulatedDimensions.map((dimension) => dimension.relativeSpanError).filter((value): value is number => typeof value === "number")),
      unresolvedSourceResolvedDimensionCount,
      ambiguousDimensionCount: rasterEvidence?.stages.dimensionDiagnosticCounts.ambiguous_source_axis ?? 0,
      totalDimensionCount: rasterEvidence ? rasterEvidence.stages.matchedDimensionCount + rasterEvidence.stages.unresolvedDimensionCount : 0,
      unsupportedHighConfidenceWallCount: unsupportedHighConfidenceWallCount ?? 0,
    });

    return NextResponse.json({
      mode: "read_only_architectural_candidate",
      source: { versionId, sheetNumber: String(sheetResponse.data.sheet_number || ""), sheetTitle: String(sheetResponse.data.title || ""), originalFilename: String(versionResponse.data.original_filename || ""), expectedPage: expectedPage ?? null },
      candidate: benchmark,
      rasterEvidence,
      phaseFidelityAudit,
      canonical: canonical ? {
        modelId: canonical.id || null,
        status: canonical.status || null,
        engineStatus: canonical.engine_status || null,
        reconstructionVersion: canonical.reconstruction_version || null,
        sourcePage: canonical.source_page || null,
        wallCount: Array.isArray(graph?.walls) ? graph.walls.length : null,
        roomCount: Array.isArray(graph?.rooms) ? graph.rooms.length : null,
        openingCount: Array.isArray(graph?.openings) ? graph.openings.length : null,
        validation: canonical.validation_report || null,
        updatedAt: canonical.updated_at || null,
      } : null,
      safety: { writesPerformed: false, canonicalGeometryChanged: false, generated3d: false },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run Blueprint engine benchmark." }, { status: 400 });
  }
}
