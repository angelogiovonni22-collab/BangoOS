import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import { parsePdfVectorPlan } from "@/lib/blueprints/engine/pdf-vector-parser";
import { normalizeParsedPlan, summarizeSelectedPlan } from "@/lib/blueprints/engine/plan-parser";
import { extractRasterLineSegments } from "@/lib/blueprints/engine/raster";
import { buildRasterArchitecturalCandidate } from "@/lib/blueprints/engine/raster-architectural-candidate";
import { renderBlueprintGraySource } from "@/lib/blueprints/engine/source-pixel-overlay";
import { buildIndependentSourceWallNetworkEvidence } from "@/lib/blueprints/engine/source-wall-network-overlay";
import { diagnoseSourcePairFamilyAgreement } from "@/lib/blueprints/engine/source-pair-family-agreement-diagnostic";
import { diagnoseSourcePairFamilyGaps } from "@/lib/blueprints/engine/source-pair-family-gap-diagnostic";
import { diagnoseSourcePairCoordinateOffsets } from "@/lib/blueprints/engine/source-pair-coordinate-offset-diagnostic";
import { diagnoseSourcePairRasterPairingGaps } from "@/lib/blueprints/engine/source-pair-raster-pairing-gap-diagnostic";
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
    if (versionResponse.data.mime_type !== "application/pdf") return NextResponse.json({ error: "Source residual summary requires a PDF Blueprint." }, { status: 415 });
    const fileSize = Number(versionResponse.data.file_size_bytes || 0);
    if (fileSize <= 0 || fileSize > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Blueprint source is outside the safe read-only summary size limit." }, { status: 413 });

    const sheetResponse = await db.from("blueprint_sheets")
      .select("sheet_number,title,discipline")
      .eq("id", versionResponse.data.blueprint_sheet_id)
      .eq("company_id", workspace.context.companyId)
      .maybeSingle();
    if (sheetResponse.error) throw new Error(sheetResponse.error.message);
    if (!sheetResponse.data) throw new Error("Blueprint sheet metadata not found.");

    const url = new URL(request.url);
    const expectedPageParam = Number(url.searchParams.get("expectedPage"));
    const expectedPage = Number.isInteger(expectedPageParam) && expectedPageParam > 0 ? expectedPageParam : undefined;

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
    if (!selected.scale.drawingUnitsPerMeter || selected.scale.confidence < 0.55) throw new Error("Verified Blueprint scale is required for source residual diagnosis.");

    const raster = await extractRasterLineSegments(buffer, {
      page: plan.selectedPage,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
      sourceWidth: selected.page.width,
      sourceHeight: selected.page.height,
    });
    const candidate = buildRasterArchitecturalCandidate({
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
    const shared = {
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    };
    const familyAgreement = diagnoseSourcePairFamilyAgreement({
      retainedSourcePairs: sourceEvidence.network.wallFacePairs,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: candidate.sheetFrameSelection.wallSystems,
      ...shared,
    });
    const familyGaps = diagnoseSourcePairFamilyGaps({
      familyAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: candidate.sheetFrameSelection.wallSystems,
      ...shared,
    });
    const coordinateOffsets = diagnoseSourcePairCoordinateOffsets({
      familyAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: candidate.sheetFrameSelection.wallSystems,
      ...shared,
    });
    const rasterPairing = diagnoseSourcePairRasterPairingGaps({
      familyAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      annotationFilteredSegments: candidate.annotationFiltered,
      explicitWallSystems: candidate.explicitSystems,
      sheetFrameWallSystems: candidate.sheetFrameSelection.wallSystems,
      ...shared,
    });
    const conflict = rasterPairing.conflictProvenance;
    const replacement = rasterPairing.isolatedReplacementSimulation;

    return NextResponse.json({
      mode: "read_only_source_residual_root_cause_summary",
      source: {
        versionId,
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        sheetTitle: String(sheetResponse.data.title || ""),
        originalFilename: String(versionResponse.data.original_filename || ""),
        selectedPage: plan.selectedPage,
        expectedPage: expectedPage ?? null,
      },
      counts: {
        retainedSourcePairCount: sourceEvidence.network.wallFacePairs.length,
        explicitWallSystemCount: candidate.sheetFrameSelection.wallSystems.length,
        selectedStructuralWallCount: candidate.structuralSelection.wallSystems.length,
      },
      familyAgreement: {
        uniqueAgreementCount: familyAgreement.uniqueAgreementCount,
        ambiguousAgreementCount: familyAgreement.ambiguousAgreementCount,
        noAgreementCount: familyAgreement.noAgreementCount,
        missingFamilyCount: familyAgreement.missingFamilyCount,
      },
      familyGaps: {
        familyCount: familyGaps.familyCount,
        memberCount: familyGaps.memberCount,
        reasonMemberCounts: familyGaps.reasonMemberCounts,
        reasonFamilyCounts: familyGaps.reasonFamilyCounts,
      },
      coordinateOffsets: {
        observationCount: coordinateOffsets.observationCount,
        familyCount: coordinateOffsets.familyCount,
        horizontalObservationCount: coordinateOffsets.horizontalObservationCount,
        verticalObservationCount: coordinateOffsets.verticalObservationCount,
        medianSignedOffsetMeters: coordinateOffsets.medianSignedOffsetMeters,
        bestCandidateByOrientation: coordinateOffsets.simulation.bestCandidateByOrientation,
      },
      rasterPairing: {
        familyCount: rasterPairing.familyCount,
        memberCount: rasterPairing.memberCount,
        reasonMemberCounts: rasterPairing.reasonMemberCounts,
        reasonFamilyCounts: rasterPairing.reasonFamilyCounts,
      },
      conflictProvenance: conflict ? {
        familyCount: conflict.familyCount,
        memberCount: conflict.memberCount,
        memberReasonCounts: conflict.memberReasonCounts,
        familyReasonCounts: conflict.familyReasonCounts,
      } : null,
      isolatedReplacementSimulation: replacement ? {
        eligibleFamilyCount: replacement.eligibleFamilyCount,
        simulatedFamilyCount: replacement.simulatedFamilyCount,
        skippedCrossFamilyConflictCount: replacement.skippedCrossFamilyConflictCount,
        removedWallIds: replacement.removedWallIds,
        addedCandidateIds: replacement.addedCandidateIds,
        before: replacement.before,
        after: replacement.after,
        delta: replacement.delta,
        familyOutcomes: replacement.familyOutcomes,
        previouslyUniqueRegressionFamilyIds: replacement.previouslyUniqueRegressionFamilyIds,
        safeToConsiderPromotion: replacement.safeToConsiderPromotion,
      } : null,
      safety: {
        writesPerformed: false,
        extractionChanged: false,
        pairingChanged: false,
        selectorDefaultsChanged: false,
        canonicalGeometryChanged: false,
        generated3d: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run source residual root-cause summary." }, { status: 400 });
  }
}
