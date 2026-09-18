import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import { parsePdfVectorPlan } from "@/lib/blueprints/engine/pdf-vector-parser";
import { normalizeParsedPlan, summarizeSelectedPlan } from "@/lib/blueprints/engine/plan-parser";
import { DEFAULT_RASTER_LINE_OPTIONS, extractRasterLineSegments } from "@/lib/blueprints/engine/raster";
import { buildRasterArchitecturalCandidate } from "@/lib/blueprints/engine/raster-architectural-candidate";
import { renderBlueprintGraySource } from "@/lib/blueprints/engine/source-pixel-overlay";
import { buildIndependentSourceWallNetworkEvidence } from "@/lib/blueprints/engine/source-wall-network-overlay";
import { diagnoseSourcePairFamilyAgreement } from "@/lib/blueprints/engine/source-pair-family-agreement-diagnostic";
import { diagnoseSourcePairFamilyGaps } from "@/lib/blueprints/engine/source-pair-family-gap-diagnostic";
import { diagnoseSourcePairCoordinateOffsets } from "@/lib/blueprints/engine/source-pair-coordinate-offset-diagnostic";
import { diagnoseCompleteLinkFamilySplits } from "@/lib/blueprints/engine/source-pair-complete-link-split-diagnostic";
import { diagnoseSourcePairRasterPairingGaps } from "@/lib/blueprints/engine/source-pair-raster-pairing-gap-diagnostic";
import { diagnoseNoMatchingRasterStages } from "@/lib/blueprints/engine/source-pair-raster-stage-gap-diagnostic";
import { diagnosePairBuilderConsistencyGaps } from "@/lib/blueprints/engine/source-pair-raster-pair-builder-consistency-diagnostic";
import { diagnoseRasterDedupeGaps } from "@/lib/blueprints/engine/source-pair-raster-dedupe-gap-diagnostic";
import { summarizeRasterMinRunParitySimulation } from "@/lib/blueprints/engine/source-pair-raster-minrun-simulation";
import { summarizeRasterRunParitySimulation } from "@/lib/blueprints/engine/source-pair-raster-run-parity-simulation";
import { summarizeRasterDedupePreservationSimulation } from "@/lib/blueprints/engine/source-pair-raster-dedupe-preservation-simulation";
import type { Database } from "@/types/database.types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const MAX_SOURCE_BYTES = 45 * 1024 * 1024;
const PARITY_MIN_RUN_PIXELS = 24;
const PARITY_GAP_PIXELS = 0;

function dbClient(supabase: SupabaseClient<Database>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
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
      .select("id,company_id,blueprint_sheet_id,storage_path,original_filename,mime_type,file_size_bytes")
      .eq("id", versionId)
      .eq("company_id", workspace.context.companyId)
      .maybeSingle();
    if (versionResponse.error) throw new Error(versionResponse.error.message);
    if (!versionResponse.data) throw new Error("Blueprint revision not found.");
    if (versionResponse.data.mime_type !== "application/pdf") return NextResponse.json({ error: "Blueprint source-family audit currently requires a PDF Blueprint." }, { status: 415 });
    const fileSize = Number(versionResponse.data.file_size_bytes || 0);
    if (fileSize <= 0 || fileSize > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Blueprint source is outside the safe read-only audit size limit." }, { status: 413 });

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
    const runMinRunSimulation = url.searchParams.get("minRunSimulation") === "1";
    const runRasterRunParitySimulation = url.searchParams.get("runParitySimulation") === "1";
    const runDedupePreservationSimulation = url.searchParams.get("dedupePreservationSimulation") === "1";
    if (expectedPage && plan.selectedPage !== expectedPage) throw new Error(`Expected Blueprint page ${expectedPage}, but parser selected page ${plan.selectedPage}.`);
    const selected = summarizeSelectedPlan(plan, "level-1");
    if (!selected.scale.drawingUnitsPerMeter || selected.scale.confidence < 0.55) throw new Error("Verified Blueprint scale is required for source-family auditing.");

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
    const sourceImage = await renderBlueprintGraySource(buffer, plan.selectedPage);
    const sourceEvidence = buildIndependentSourceWallNetworkEvidence({
      image: sourceImage,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const familyAgreement = diagnoseSourcePairFamilyAgreement({
      retainedSourcePairs: sourceEvidence.network.wallFacePairs,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const noAgreementGapDiagnostic = diagnoseSourcePairFamilyGaps({
      familyAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const coordinateOffsetDiagnostic = diagnoseSourcePairCoordinateOffsets({
      familyAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const rasterPairingGapDiagnostic = diagnoseSourcePairRasterPairingGaps({
      familyAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      annotationFilteredSegments: architecturalCandidate.annotationFiltered,
      explicitWallSystems: architecturalCandidate.explicitSystems,
      sheetFrameWallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const noMatchingRasterStageDiagnostic = diagnoseNoMatchingRasterStages({
      consolidationClusters: sourceEvidence.consolidated.clusters,
      rasterPairingGapDiagnostic,
      rawSegments: architecturalCandidate.rawSegments,
      annotationFilteredSegments: architecturalCandidate.annotationFiltered,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const pairBuilderConsistencyDiagnostic = diagnosePairBuilderConsistencyGaps({
      stageDiagnostic: noMatchingRasterStageDiagnostic,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      annotationFilteredSegments: architecturalCandidate.annotationFiltered,
      explicitWallSystems: architecturalCandidate.explicitSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const rasterDedupeGapDiagnostic = diagnoseRasterDedupeGaps({
      stageDiagnostic: noMatchingRasterStageDiagnostic,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      rawSegments: architecturalCandidate.rawSegments,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      rasterPixelWidth: raster.pixelWidth,
      rasterPixelHeight: raster.pixelHeight,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
      rasterMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
      mergeBandPixels: DEFAULT_RASTER_LINE_OPTIONS.mergeBandPixels,
    });

    async function runExtractionSimulation(options: { minRunPixels: number; gapPixels?: number }, dedupeMode?: "longest_per_band" | "keep_all") {
      const simulatedRaster = await extractRasterLineSegments(buffer, {
        page: plan.selectedPage,
        drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter!,
        sourceWidth: selected.page.width,
        sourceHeight: selected.page.height,
        options,
        dedupeMode,
      });
      const simulatedCandidate = buildRasterArchitecturalCandidate({
        segments: simulatedRaster.segments,
        dimensions: selected.dimensions,
        drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter!,
        sourceWidthMeters: simulatedRaster.width,
        sourceHeightMeters: simulatedRaster.height,
      });
      const simulatedAgreement = diagnoseSourcePairFamilyAgreement({
        retainedSourcePairs: sourceEvidence.network.wallFacePairs,
        consolidationClusters: sourceEvidence.consolidated.clusters,
        explicitWallSystems: simulatedCandidate.sheetFrameSelection.wallSystems,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: simulatedRaster.width,
        sourceHeightMeters: simulatedRaster.height,
      });
      const simulatedPairingGap = diagnoseSourcePairRasterPairingGaps({
        familyAgreement: simulatedAgreement,
        consolidationClusters: sourceEvidence.consolidated.clusters,
        annotationFilteredSegments: simulatedCandidate.annotationFiltered,
        explicitWallSystems: simulatedCandidate.explicitSystems,
        sheetFrameWallSystems: simulatedCandidate.sheetFrameSelection.wallSystems,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: simulatedRaster.width,
        sourceHeightMeters: simulatedRaster.height,
      });
      const simulatedStage = diagnoseNoMatchingRasterStages({
        consolidationClusters: sourceEvidence.consolidated.clusters,
        rasterPairingGapDiagnostic: simulatedPairingGap,
        rawSegments: simulatedCandidate.rawSegments,
        annotationFilteredSegments: simulatedCandidate.annotationFiltered,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: simulatedRaster.width,
        sourceHeightMeters: simulatedRaster.height,
      });
      return { raster: simulatedRaster, agreement: simulatedAgreement, stage: simulatedStage };
    }

    let rasterMinRunParitySimulation = null;
    if (runMinRunSimulation) {
      const simulated = await runExtractionSimulation({ minRunPixels: PARITY_MIN_RUN_PIXELS });
      rasterMinRunParitySimulation = summarizeRasterMinRunParitySimulation({
        baselineMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
        simulatedMinRunPixels: PARITY_MIN_RUN_PIXELS,
        baselineRasterSegmentCount: raster.segments.length,
        simulatedRasterSegmentCount: simulated.raster.segments.length,
        beforeAgreement: familyAgreement,
        afterAgreement: simulated.agreement,
        beforeStageDiagnostic: noMatchingRasterStageDiagnostic,
        afterStageDiagnostic: simulated.stage,
      });
    }

    let rasterRunParitySimulation = null;
    if (runRasterRunParitySimulation) {
      const simulated = await runExtractionSimulation({ minRunPixels: PARITY_MIN_RUN_PIXELS, gapPixels: PARITY_GAP_PIXELS });
      rasterRunParitySimulation = summarizeRasterRunParitySimulation({
        baselineMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
        simulatedMinRunPixels: PARITY_MIN_RUN_PIXELS,
        baselineGapPixels: DEFAULT_RASTER_LINE_OPTIONS.gapPixels,
        simulatedGapPixels: PARITY_GAP_PIXELS,
        baselineRasterSegmentCount: raster.segments.length,
        simulatedRasterSegmentCount: simulated.raster.segments.length,
        beforeAgreement: familyAgreement,
        afterAgreement: simulated.agreement,
        beforeStageDiagnostic: noMatchingRasterStageDiagnostic,
        afterStageDiagnostic: simulated.stage,
      });
    }

    let rasterDedupePreservationSimulation = null;
    if (runDedupePreservationSimulation) {
      const simulated = await runExtractionSimulation({
        minRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
        gapPixels: DEFAULT_RASTER_LINE_OPTIONS.gapPixels,
      }, "keep_all");
      rasterDedupePreservationSimulation = summarizeRasterDedupePreservationSimulation({
        rasterMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
        baselineRasterSegmentCount: raster.segments.length,
        simulatedRasterSegmentCount: simulated.raster.segments.length,
        beforeAgreement: familyAgreement,
        afterAgreement: simulated.agreement,
        beforeStageDiagnostic: noMatchingRasterStageDiagnostic,
        afterStageDiagnostic: simulated.stage,
      });
    }

    const completeLinkEvidence = buildIndependentSourceWallNetworkEvidence({
      image: sourceImage,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
      consolidationOptions: { clusteringMode: "complete_link" },
    });
    const completeLinkFamilyAgreement = diagnoseSourcePairFamilyAgreement({
      retainedSourcePairs: completeLinkEvidence.network.wallFacePairs,
      consolidationClusters: completeLinkEvidence.consolidated.clusters,
      explicitWallSystems: architecturalCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const completeLinkFamilySplitDiagnostic = diagnoseCompleteLinkFamilySplits({
      singleLinkClusters: sourceEvidence.consolidated.clusters,
      completeLinkClusters: completeLinkEvidence.consolidated.clusters,
      completeLinkFamilyAgreement,
    });

    return NextResponse.json({
      mode: "read_only_source_pair_family_audit",
      source: {
        versionId,
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        sheetTitle: String(sheetResponse.data.title || ""),
        originalFilename: String(versionResponse.data.original_filename || ""),
        selectedPage: plan.selectedPage,
        expectedPage: expectedPage ?? null,
      },
      extraction: {
        rasterSegmentCount: raster.segments.length,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        rasterPixelWidth: raster.pixelWidth,
        rasterPixelHeight: raster.pixelHeight,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      },
      evidence: {
        rawPairCount: sourceEvidence.faces.wallFacePairs.length,
        consolidatedPairCount: sourceEvidence.consolidated.wallFacePairs.length,
        consolidationClusterCount: sourceEvidence.consolidated.clusterCount,
        retainedPairCount: sourceEvidence.network.wallFacePairs.length,
        explicitWallSystemCount: architecturalCandidate.sheetFrameSelection.wallSystems.length,
      },
      familyAgreement,
      noAgreementGapDiagnostic,
      coordinateOffsetDiagnostic,
      rasterPairingGapDiagnostic,
      noMatchingRasterStageDiagnostic,
      pairBuilderConsistencyDiagnostic,
      rasterDedupeGapDiagnostic,
      rasterMinRunParitySimulation,
      rasterRunParitySimulation,
      rasterDedupePreservationSimulation,
      completeLinkSimulation: {
        mode: "read_only_complete_link_source_pair_simulation",
        evidence: {
          rawPairCount: completeLinkEvidence.faces.wallFacePairs.length,
          consolidatedPairCount: completeLinkEvidence.consolidated.wallFacePairs.length,
          consolidationClusterCount: completeLinkEvidence.consolidated.clusterCount,
          retainedPairCount: completeLinkEvidence.network.wallFacePairs.length,
          retainedComponentCount: completeLinkEvidence.network.retainedComponentCount,
        },
        familyAgreement: completeLinkFamilyAgreement,
        familySplitDiagnostic: completeLinkFamilySplitDiagnostic,
        delta: {
          retainedPairCount: completeLinkEvidence.network.wallFacePairs.length - sourceEvidence.network.wallFacePairs.length,
          uniqueAgreementCount: completeLinkFamilyAgreement.uniqueAgreementCount - familyAgreement.uniqueAgreementCount,
          ambiguousAgreementCount: completeLinkFamilyAgreement.ambiguousAgreementCount - familyAgreement.ambiguousAgreementCount,
          noAgreementCount: completeLinkFamilyAgreement.noAgreementCount - familyAgreement.noAgreementCount,
          missingFamilyCount: completeLinkFamilyAgreement.missingFamilyCount - familyAgreement.missingFamilyCount,
        },
        diagnostics: [
          "Complete-link simulation reuses the same rendered-source extraction, source-network selector, explicit wall systems, and hard family-agreement gates.",
          "Only source-pair family clustering changes: every member of a complete-link family must satisfy the existing consolidation tolerances with every other family member.",
          "Read-only simulation: production source selection, reconstructed geometry, thresholds, persistence, and canonical data are unchanged.",
        ],
      },
      safety: { writesPerformed: false, sourceSelectionChanged: false, canonicalGeometryChanged: false, generated3d: false },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run Blueprint source-family audit." }, { status: 400 });
  }
}
