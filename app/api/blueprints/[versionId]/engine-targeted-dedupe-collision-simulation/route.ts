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
import { diagnoseRasterDedupeGaps } from "@/lib/blueprints/engine/source-pair-raster-dedupe-gap-diagnostic";
import { selectTargetedDedupeCollisionSegments, summarizeTargetedDedupeCollisionSimulation } from "@/lib/blueprints/engine/source-pair-raster-targeted-dedupe-simulation";
import type { Database } from "@/types/database.types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const MAX_SOURCE_BYTES = 45 * 1024 * 1024;

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
    if (versionResponse.data.mime_type !== "application/pdf") return NextResponse.json({ error: "B.O.S. targeted de-duplication simulation currently requires a PDF Blueprint." }, { status: 415 });
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
    const url = new URL(request.url);
    const expectedPageParam = Number(url.searchParams.get("expectedPage"));
    const expectedPage = Number.isInteger(expectedPageParam) && expectedPageParam > 0 ? expectedPageParam : undefined;
    const familyIsolationId = url.searchParams.get("familyIsolationId")?.trim() || null;
    if (expectedPage && plan.selectedPage !== expectedPage) throw new Error(`Expected Blueprint page ${expectedPage}, but parser selected page ${plan.selectedPage}.`);
    const selected = summarizeSelectedPlan(plan, "level-1");
    if (!selected.scale.drawingUnitsPerMeter || selected.scale.confidence < 0.55) throw new Error("Verified Blueprint scale is required for targeted de-duplication simulation.");

    const rasterInput = {
      page: plan.selectedPage,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
      sourceWidth: selected.page.width,
      sourceHeight: selected.page.height,
    };
    const baselineRaster = await extractRasterLineSegments(buffer, rasterInput);
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
    const baselineAgreement = diagnoseSourcePairFamilyAgreement({
      retainedSourcePairs: sourceEvidence.network.wallFacePairs,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: baselineCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const baselinePairing = diagnoseSourcePairRasterPairingGaps({
      familyAgreement: baselineAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      annotationFilteredSegments: baselineCandidate.annotationFiltered,
      explicitWallSystems: baselineCandidate.explicitSystems,
      sheetFrameWallSystems: baselineCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const baselineStage = diagnoseNoMatchingRasterStages({
      consolidationClusters: sourceEvidence.consolidated.clusters,
      rasterPairingGapDiagnostic: baselinePairing,
      rawSegments: baselineCandidate.rawSegments,
      annotationFilteredSegments: baselineCandidate.annotationFiltered,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const dedupeGap = diagnoseRasterDedupeGaps({
      stageDiagnostic: baselineStage,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      rawSegments: baselineCandidate.rawSegments,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      rasterPixelWidth: baselineRaster.pixelWidth,
      rasterPixelHeight: baselineRaster.pixelHeight,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
      rasterMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
      mergeBandPixels: DEFAULT_RASTER_LINE_OPTIONS.mergeBandPixels,
    });

    const collisionMembers = dedupeGap.members.filter((member) => member.failedFaces.some((face) => face.reason === "dedupe_band_collision"));
    const affectedFamilyIds = [...new Set(collisionMembers.map((member) => member.representativePairId))].sort();
    if (familyIsolationId && !affectedFamilyIds.includes(familyIsolationId)) {
      return NextResponse.json({ error: "Requested source family does not contain a proven raster de-duplication collision." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const targetedCollisionMembers = familyIsolationId
      ? collisionMembers.filter((member) => member.representativePairId === familyIsolationId)
      : collisionMembers;
    const collisionBandKeys = [...new Set(targetedCollisionMembers.flatMap((member) => member.failedFaces
      .filter((face) => face.reason === "dedupe_band_collision" && face.expectedBandKey)
      .map((face) => face.expectedBandKey as string)))].sort();

    const keepAllRaster = await extractRasterLineSegments(buffer, { ...rasterInput, dedupeMode: "keep_all" });
    const targeted = selectTargetedDedupeCollisionSegments({
      baselineSegments: baselineRaster.segments,
      keepAllSegments: keepAllRaster.segments,
      collisionBandKeys,
      rasterPixelWidth: baselineRaster.pixelWidth,
      rasterPixelHeight: baselineRaster.pixelHeight,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
      mergeBandPixels: DEFAULT_RASTER_LINE_OPTIONS.mergeBandPixels,
    });
    const simulatedCandidate = buildRasterArchitecturalCandidate({
      segments: targeted.segments,
      dimensions: selected.dimensions,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const simulatedAgreement = diagnoseSourcePairFamilyAgreement({
      retainedSourcePairs: sourceEvidence.network.wallFacePairs,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: simulatedCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const simulatedPairing = diagnoseSourcePairRasterPairingGaps({
      familyAgreement: simulatedAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      annotationFilteredSegments: simulatedCandidate.annotationFiltered,
      explicitWallSystems: simulatedCandidate.explicitSystems,
      sheetFrameWallSystems: simulatedCandidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const simulatedStage = diagnoseNoMatchingRasterStages({
      consolidationClusters: sourceEvidence.consolidated.clusters,
      rasterPairingGapDiagnostic: simulatedPairing,
      rawSegments: simulatedCandidate.rawSegments,
      annotationFilteredSegments: simulatedCandidate.annotationFiltered,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const simulation = summarizeTargetedDedupeCollisionSimulation({
      collisionBandKeys,
      addedSegmentIds: targeted.addedSegmentIds,
      baselineRasterSegmentCount: baselineRaster.segments.length,
      simulatedRasterSegmentCount: targeted.segments.length,
      beforeAgreement: baselineAgreement,
      afterAgreement: simulatedAgreement,
      beforeStageDiagnostic: baselineStage,
      afterStageDiagnostic: simulatedStage,
    });

    return NextResponse.json({
      mode: "read_only_targeted_raster_dedupe_collision_simulation",
      source: {
        versionId,
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        sheetTitle: String(sheetResponse.data.title || ""),
        originalFilename: String(versionResponse.data.original_filename || ""),
        selectedPage: plan.selectedPage,
        expectedPage: expectedPage ?? null,
      },
      evidence: {
        affectedFamilyIds,
        familyIsolationId,
        collisionBandKeys,
        collisionFaceCount: targetedCollisionMembers.reduce((total, member) => total + member.failedFaces.filter((face) => face.reason === "dedupe_band_collision").length, 0),
        baselineRasterSegmentCount: baselineRaster.segments.length,
        keepAllRasterSegmentCount: keepAllRaster.segments.length,
      },
      simulation,
      safety: { writesPerformed: false, sourceSelectionChanged: false, canonicalGeometryChanged: false, generated3d: false },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run targeted Blueprint de-duplication collision simulation." }, { status: 400 });
  }
}
