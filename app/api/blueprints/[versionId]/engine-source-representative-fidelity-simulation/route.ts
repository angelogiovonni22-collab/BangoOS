import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import { parsePdfVectorPlan } from "@/lib/blueprints/engine/pdf-vector-parser";
import { normalizeParsedPlan, summarizeSelectedPlan } from "@/lib/blueprints/engine/plan-parser";
import { extractRasterLineSegments } from "@/lib/blueprints/engine/raster";
import { buildRasterArchitecturalCandidate } from "@/lib/blueprints/engine/raster-architectural-candidate";
import { assessSourcePixelOverlay, renderBlueprintGraySource } from "@/lib/blueprints/engine/source-pixel-overlay";
import { buildSourceWallFaceMask } from "@/lib/blueprints/engine/source-wall-face-mask";
import { consolidateSourceWallPairs, type BosSourceWallPairConsolidationOptions } from "@/lib/blueprints/engine/source-wall-pair-consolidator";
import { selectSourceWallNetwork } from "@/lib/blueprints/engine/source-wall-network-selector";
import { assessSourceWallNetworkOverlay } from "@/lib/blueprints/engine/source-wall-network-overlay";
import { diagnoseSourcePairFamilyAgreement } from "@/lib/blueprints/engine/source-pair-family-agreement-diagnostic";
import type { Database } from "@/types/database.types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const MAX_SOURCE_BYTES = 45 * 1024 * 1024;

type RepresentativeMode = NonNullable<BosSourceWallPairConsolidationOptions["representativeMode"]>;
const MODES: RepresentativeMode[] = ["median_thickness", "longest", "maximum_thickness", "minimum_thickness"];

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
    if (versionResponse.data.mime_type !== "application/pdf") return NextResponse.json({ error: "Source representative fidelity simulation requires a PDF Blueprint." }, { status: 415 });
    const fileSize = Number(versionResponse.data.file_size_bytes || 0);
    if (fileSize <= 0 || fileSize > MAX_SOURCE_BYTES) return NextResponse.json({ error: "Blueprint source is outside the safe read-only simulation size limit." }, { status: 413 });

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
    if (!selected.scale.drawingUnitsPerMeter || selected.scale.confidence < 0.55) throw new Error("Verified Blueprint scale is required for representative fidelity simulation.");

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
    const sourceFaces = buildSourceWallFaceMask({
      image: sourceImage,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const structuralPixelOverlay = assessSourcePixelOverlay({
      image: sourceImage,
      wallSystems: candidate.structuralSelection.wallSystems,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const preselectionPixelOverlay = assessSourcePixelOverlay({
      image: sourceImage,
      wallSystems: candidate.sheetFrameSelection.wallSystems,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });

    const simulations = MODES.map((representativeMode) => {
      const consolidated = consolidateSourceWallPairs({
        wallFacePairs: sourceFaces.wallFacePairs,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
        options: { representativeMode },
      });
      const network = selectSourceWallNetwork({
        wallFacePairs: consolidated.wallFacePairs,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const evidence = { faces: sourceFaces, consolidated, network };
      const familyAgreement = diagnoseSourcePairFamilyAgreement({
        retainedSourcePairs: network.wallFacePairs,
        consolidationClusters: consolidated.clusters,
        explicitWallSystems: candidate.sheetFrameSelection.wallSystems,
        sourcePixelWidth: sourceImage.width,
        sourcePixelHeight: sourceImage.height,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const structuralNetwork = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems: candidate.structuralSelection.wallSystems,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
        predictedPrecision: structuralPixelOverlay.predictedPrecision,
        evidence,
      });
      const preselectionNetwork = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems: candidate.sheetFrameSelection.wallSystems,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
        predictedPrecision: preselectionPixelOverlay.predictedPrecision,
        evidence,
      });
      return {
        representativeMode,
        sourceOnly: true,
        retainedPairCount: network.wallFacePairs.length,
        totalRetainedLengthMeters: network.totalRetainedLengthMeters,
        familyAgreement: {
          uniqueAgreementCount: familyAgreement.uniqueAgreementCount,
          ambiguousAgreementCount: familyAgreement.ambiguousAgreementCount,
          noAgreementCount: familyAgreement.noAgreementCount,
          missingFamilyCount: familyAgreement.missingFamilyCount,
        },
        preselection: {
          predictedPrecision: preselectionPixelOverlay.predictedPrecision,
          sourceNetworkRecall: preselectionNetwork.recall,
          sourceNetworkF1: preselectionNetwork.f1,
        },
        structural: {
          wallCount: candidate.structuralSelection.wallSystems.length,
          predictedPrecision: structuralPixelOverlay.predictedPrecision,
          sourceNetworkRecall: structuralNetwork.recall,
          sourceNetworkF1: structuralNetwork.f1,
          uncoveredSourceLengthRatio: structuralNetwork.coverageGaps.uncoveredLengthRatio,
        },
      };
    });

    return NextResponse.json({
      mode: "read_only_source_representative_fidelity_simulation",
      source: {
        versionId,
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        sheetTitle: String(sheetResponse.data.title || ""),
        originalFilename: String(versionResponse.data.original_filename || ""),
        selectedPage: plan.selectedPage,
        expectedPage: expectedPage ?? null,
      },
      baselineRepresentativeMode: "median_thickness",
      simulations,
      safety: {
        writesPerformed: false,
        extractionChanged: false,
        productionRepresentativeModeChanged: false,
        selectorDefaultsChanged: false,
        canonicalGeometryChanged: false,
        generated3d: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run source representative fidelity simulation." }, { status: 400 });
  }
}
