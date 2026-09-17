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
import { diagnoseSourcePairRasterPairingGaps } from "@/lib/blueprints/engine/source-pair-raster-pairing-gap-diagnostic";
import { diagnoseNoMatchingRasterStages } from "@/lib/blueprints/engine/source-pair-raster-stage-gap-diagnostic";
import { summarizeRasterMinRunParitySimulation } from "@/lib/blueprints/engine/source-pair-raster-minrun-simulation";
import { summarizeRasterRunParitySimulation } from "@/lib/blueprints/engine/source-pair-raster-run-parity-simulation";
import { summarizeRasterDedupePreservationSimulation } from "@/lib/blueprints/engine/source-pair-raster-dedupe-preservation-simulation";
import type { Database } from "@/types/database.types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const MAX_SOURCE_BYTES = 45 * 1024 * 1024;
const PARITY_MIN_RUN_PIXELS = 24;
const PARITY_GAP_PIXELS = 0;

type Mode = "minrun" | "runparity" | "dedupe";

function dbClient(supabase: SupabaseClient<Database>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const url = new URL(request.url);
    const modeParam = url.searchParams.get("mode");
    const mode: Mode = modeParam === "runparity" || modeParam === "dedupe" ? modeParam : "minrun";
    const expectedPageParam = Number(url.searchParams.get("expectedPage"));
    const expectedPage = Number.isInteger(expectedPageParam) && expectedPageParam > 0 ? expectedPageParam : undefined;

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
    if (versionResponse.data.mime_type !== "application/pdf") return NextResponse.json({ error: "Raster extraction parity summary requires a PDF Blueprint." }, { status: 415 });
    const fileSize = Number(versionResponse.data.file_size_bytes || 0);
    if (fileSize <= 0 || fileSize > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Blueprint source is outside the safe read-only simulation size limit." }, { status: 413 });

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
    if (expectedPage && plan.selectedPage !== expectedPage) throw new Error(`Expected Blueprint page ${expectedPage}, but parser selected page ${plan.selectedPage}.`);
    const selected = summarizeSelectedPlan(plan, "level-1");
    if (!selected.scale.drawingUnitsPerMeter || selected.scale.confidence < 0.55) throw new Error("Verified Blueprint scale is required for raster extraction parity summary.");

    const extractionInput = {
      page: plan.selectedPage,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
      sourceWidth: selected.page.width,
      sourceHeight: selected.page.height,
    };
    const baselineRaster = await extractRasterLineSegments(buffer, extractionInput);
    const baselineCandidate = buildRasterArchitecturalCandidate({
      segments: baselineRaster.segments,
      dimensions: selected.dimensions,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const sourceImage = await renderBlueprintGraySource(buffer, plan.selectedPage);
    const sourceEvidence = buildIndependentSourceWallNetworkEvidence({
      image: sourceImage,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const shared = {
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    };
    const agreementFor = (candidate: ReturnType<typeof buildRasterArchitecturalCandidate>) => diagnoseSourcePairFamilyAgreement({
      retainedSourcePairs: sourceEvidence.network.wallFacePairs,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: candidate.sheetFrameSelection.wallSystems,
      ...shared,
    });
    const stageFor = (candidate: ReturnType<typeof buildRasterArchitecturalCandidate>, agreement: ReturnType<typeof agreementFor>) => {
      const pairing = diagnoseSourcePairRasterPairingGaps({
        familyAgreement: agreement,
        consolidationClusters: sourceEvidence.consolidated.clusters,
        annotationFilteredSegments: candidate.annotationFiltered,
        explicitWallSystems: candidate.explicitSystems,
        sheetFrameWallSystems: candidate.sheetFrameSelection.wallSystems,
        ...shared,
      });
      return diagnoseNoMatchingRasterStages({
        consolidationClusters: sourceEvidence.consolidated.clusters,
        rasterPairingGapDiagnostic: pairing,
        rawSegments: candidate.rawSegments,
        annotationFilteredSegments: candidate.annotationFiltered,
        ...shared,
      });
    };
    const baselineAgreement = agreementFor(baselineCandidate);
    const baselineStage = stageFor(baselineCandidate, baselineAgreement);

    const simulatedRaster = mode === "dedupe"
      ? await extractRasterLineSegments(buffer, { ...extractionInput, dedupeMode: "keep_all" })
      : mode === "runparity"
        ? await extractRasterLineSegments(buffer, { ...extractionInput, options: { minRunPixels: PARITY_MIN_RUN_PIXELS, gapPixels: PARITY_GAP_PIXELS } })
        : await extractRasterLineSegments(buffer, { ...extractionInput, options: { minRunPixels: PARITY_MIN_RUN_PIXELS } });
    const simulatedCandidate = buildRasterArchitecturalCandidate({
      segments: simulatedRaster.segments,
      dimensions: selected.dimensions,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
      sourceWidthMeters: simulatedRaster.width,
      sourceHeightMeters: simulatedRaster.height,
    });
    const simulatedAgreement = agreementFor(simulatedCandidate);
    const simulatedStage = stageFor(simulatedCandidate, simulatedAgreement);

    const simulation = mode === "dedupe"
      ? summarizeRasterDedupePreservationSimulation({
          rasterMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
          baselineRasterSegmentCount: baselineRaster.segments.length,
          simulatedRasterSegmentCount: simulatedRaster.segments.length,
          beforeAgreement: baselineAgreement,
          afterAgreement: simulatedAgreement,
          beforeStageDiagnostic: baselineStage,
          afterStageDiagnostic: simulatedStage,
        })
      : mode === "runparity"
        ? summarizeRasterRunParitySimulation({
            baselineMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
            simulatedMinRunPixels: PARITY_MIN_RUN_PIXELS,
            baselineGapPixels: DEFAULT_RASTER_LINE_OPTIONS.gapPixels,
            simulatedGapPixels: PARITY_GAP_PIXELS,
            baselineRasterSegmentCount: baselineRaster.segments.length,
            simulatedRasterSegmentCount: simulatedRaster.segments.length,
            beforeAgreement: baselineAgreement,
            afterAgreement: simulatedAgreement,
            beforeStageDiagnostic: baselineStage,
            afterStageDiagnostic: simulatedStage,
          })
        : summarizeRasterMinRunParitySimulation({
            baselineMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
            simulatedMinRunPixels: PARITY_MIN_RUN_PIXELS,
            baselineRasterSegmentCount: baselineRaster.segments.length,
            simulatedRasterSegmentCount: simulatedRaster.segments.length,
            beforeAgreement: baselineAgreement,
            afterAgreement: simulatedAgreement,
            beforeStageDiagnostic: baselineStage,
            afterStageDiagnostic: simulatedStage,
          });

    return NextResponse.json({
      mode: "read_only_raster_extraction_parity_summary",
      simulationMode: mode,
      source: {
        versionId,
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        sheetTitle: String(sheetResponse.data.title || ""),
        originalFilename: String(versionResponse.data.original_filename || ""),
        selectedPage: plan.selectedPage,
        expectedPage: expectedPage ?? null,
      },
      baseline: {
        rasterSegmentCount: baselineRaster.segments.length,
        explicitWallSystemCount: baselineCandidate.sheetFrameSelection.wallSystems.length,
        familyAgreement: {
          uniqueAgreementCount: baselineAgreement.uniqueAgreementCount,
          ambiguousAgreementCount: baselineAgreement.ambiguousAgreementCount,
          noAgreementCount: baselineAgreement.noAgreementCount,
          missingFamilyCount: baselineAgreement.missingFamilyCount,
        },
        noMatchingStage: baselineStage.reasonMemberCounts,
      },
      simulated: {
        rasterSegmentCount: simulatedRaster.segments.length,
        explicitWallSystemCount: simulatedCandidate.sheetFrameSelection.wallSystems.length,
        familyAgreement: {
          uniqueAgreementCount: simulatedAgreement.uniqueAgreementCount,
          ambiguousAgreementCount: simulatedAgreement.ambiguousAgreementCount,
          noAgreementCount: simulatedAgreement.noAgreementCount,
          missingFamilyCount: simulatedAgreement.missingFamilyCount,
        },
        noMatchingStage: simulatedStage.reasonMemberCounts,
      },
      simulation,
      safety: {
        writesPerformed: false,
        productionExtractionChanged: false,
        productionDedupeChanged: false,
        selectorDefaultsChanged: false,
        canonicalGeometryChanged: false,
        generated3d: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run raster extraction parity summary." }, { status: 400 });
  }
}
