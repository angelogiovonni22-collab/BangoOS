import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import { parsePdfVectorPlan } from "@/lib/blueprints/engine/pdf-vector-parser";
import { normalizeParsedPlan, summarizeSelectedPlan } from "@/lib/blueprints/engine/plan-parser";
import { DEFAULT_RASTER_LINE_OPTIONS, extractRasterLineSegments } from "@/lib/blueprints/engine/raster";
import { buildRasterArchitecturalCandidate } from "@/lib/blueprints/engine/raster-architectural-candidate";
import { assessSourcePixelOverlay, renderBlueprintGraySource } from "@/lib/blueprints/engine/source-pixel-overlay";
import { assessSourceWallNetworkOverlay, buildIndependentSourceWallNetworkEvidence } from "@/lib/blueprints/engine/source-wall-network-overlay";
import { diagnoseSourcePairFamilyAgreement } from "@/lib/blueprints/engine/source-pair-family-agreement-diagnostic";
import { topologyMetrics } from "@/lib/blueprints/engine/geometry";
import { summarizeSourceBackedShortRunFidelitySimulation } from "@/lib/blueprints/engine/source-backed-shortrun-fidelity-simulation";
import type { Database } from "@/types/database.types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const MAX_SOURCE_BYTES = 45 * 1024 * 1024;
const SOURCE_WALL_FACE_MIN_RUN_PIXELS = 24;

function dbClient(supabase: SupabaseClient<Database>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function familyReasons(report: ReturnType<typeof diagnoseSourcePairFamilyAgreement>) {
  return new Map(report.agreements.map((agreement) => [agreement.representativePairId, agreement.reason]));
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
    if (versionResponse.data.mime_type !== "application/pdf") return NextResponse.json({ error: "B.O.S. short-run fidelity simulation currently requires a PDF Blueprint." }, { status: 415 });
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
    const requestedIds = [...new Set((url.searchParams.get("segmentIds") || "").split(",").map((value) => value.trim()).filter(Boolean))].sort();
    if (!requestedIds.length) throw new Error("At least one previously-audited source-backed short-run segment ID is required.");

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
    if (!selected.scale.drawingUnitsPerMeter || selected.scale.confidence < 0.55) throw new Error("Verified Blueprint scale is required for short-run fidelity simulation.");

    const rasterInput = {
      page: plan.selectedPage,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
      sourceWidth: selected.page.width,
      sourceHeight: selected.page.height,
    };
    const baselineRaster = await extractRasterLineSegments(buffer, rasterInput);
    const sourceImage = await renderBlueprintGraySource(buffer, plan.selectedPage);
    const horizontalParityMinRun = Math.ceil(SOURCE_WALL_FACE_MIN_RUN_PIXELS * baselineRaster.pixelWidth / sourceImage.width);
    const verticalParityMinRun = Math.ceil(SOURCE_WALL_FACE_MIN_RUN_PIXELS * baselineRaster.pixelHeight / sourceImage.height);
    const sourceEquivalentMinRunPixels = Math.max(4, horizontalParityMinRun, verticalParityMinRun);
    const parityRaster = await extractRasterLineSegments(buffer, {
      ...rasterInput,
      options: { minRunPixels: sourceEquivalentMinRunPixels },
    });

    const baselineIds = new Set(baselineRaster.segments.map((segment) => String(segment.sourceObjectId || "")));
    const parityById = new Map(parityRaster.segments.map((segment) => [String(segment.sourceObjectId || ""), segment]));
    const selectedAdded = requestedIds.map((id) => {
      if (baselineIds.has(id)) throw new Error(`Requested short-run segment ${id} already exists in the Production extraction baseline.`);
      const segment = parityById.get(id);
      if (!segment) throw new Error(`Requested short-run segment ${id} is not present in the source-equivalent read-only extraction.`);
      return segment;
    });

    const buildCandidate = (segments: typeof baselineRaster.segments) => buildRasterArchitecturalCandidate({
      segments,
      dimensions: selected.dimensions,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter!,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const baselineCandidate = buildCandidate(baselineRaster.segments);
    const simulatedCandidate = buildCandidate([...baselineRaster.segments, ...selectedAdded]);
    const sourceEvidence = buildIndependentSourceWallNetworkEvidence({
      image: sourceImage,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });

    const agreement = (candidate: ReturnType<typeof buildRasterArchitecturalCandidate>) => diagnoseSourcePairFamilyAgreement({
      retainedSourcePairs: sourceEvidence.network.wallFacePairs,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      explicitWallSystems: candidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: baselineRaster.width,
      sourceHeightMeters: baselineRaster.height,
    });
    const baselineAgreement = agreement(baselineCandidate);
    const simulatedAgreement = agreement(simulatedCandidate);
    const beforeReasons = familyReasons(baselineAgreement);
    const afterReasons = familyReasons(simulatedAgreement);
    const previouslyUniqueRegressionFamilyIds = [...beforeReasons.entries()]
      .filter(([familyId, reason]) => reason === "unique_family_member_agreement" && afterReasons.get(familyId) !== "unique_family_member_agreement")
      .map(([familyId]) => familyId)
      .sort();
    const newlyUniqueFamilyIds = [...afterReasons.entries()]
      .filter(([familyId, reason]) => reason === "unique_family_member_agreement" && beforeReasons.get(familyId) !== "unique_family_member_agreement")
      .map(([familyId]) => familyId)
      .sort();
    const familyLayerSafe = selectedAdded.length > 0
      && previouslyUniqueRegressionFamilyIds.length === 0
      && simulatedAgreement.uniqueAgreementCount > baselineAgreement.uniqueAgreementCount
      && simulatedAgreement.ambiguousAgreementCount <= baselineAgreement.ambiguousAgreementCount
      && simulatedAgreement.noAgreementCount < baselineAgreement.noAgreementCount
      && simulatedAgreement.missingFamilyCount <= baselineAgreement.missingFamilyCount;

    const fidelityMetrics = (candidate: ReturnType<typeof buildRasterArchitecturalCandidate>) => {
      const constrainedWalls = candidate.constrained.wallSystems;
      const pixel = assessSourcePixelOverlay({
        image: sourceImage,
        wallSystems: constrainedWalls,
        sourceWidthMeters: baselineRaster.width,
        sourceHeightMeters: baselineRaster.height,
      });
      const network = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems: constrainedWalls,
        sourceWidthMeters: baselineRaster.width,
        sourceHeightMeters: baselineRaster.height,
        predictedPrecision: pixel.predictedPrecision,
        evidence: sourceEvidence,
      });
      const preselectionPixel = assessSourcePixelOverlay({
        image: sourceImage,
        wallSystems: candidate.sheetFrameSelection.wallSystems,
        sourceWidthMeters: baselineRaster.width,
        sourceHeightMeters: baselineRaster.height,
      });
      const preselectionNetwork = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems: candidate.sheetFrameSelection.wallSystems,
        sourceWidthMeters: baselineRaster.width,
        sourceHeightMeters: baselineRaster.height,
        predictedPrecision: preselectionPixel.predictedPrecision,
        evidence: sourceEvidence,
      });
      const supportByWallId = new Map(pixel.perWallSupport.map((item) => [item.wallSystemId, item.support]));
      const unsupportedHighConfidenceWallCount = constrainedWalls.filter((wall) => wall.confidence >= 0.8 && (supportByWallId.get(wall.id) ?? 0) < 0.95).length;
      return {
        wallCount: constrainedWalls.length,
        preselectionWallCount: candidate.sheetFrameSelection.wallSystems.length,
        predictedPrecision: pixel.predictedPrecision,
        sourceWallFaceRecall: pixel.sourceWallFaceRecall,
        sourceNetworkRecall: network.recall,
        preselectionSourceNetworkRecall: preselectionNetwork.recall,
        topologyClosure: topologyMetrics(constrainedWalls.map((wall) => wall.centerline)).closure,
        unsupportedHighConfidenceWallCount,
        dimensionAssociationCount: candidate.dimensionEvidence.associations.length,
        unresolvedDimensionCount: candidate.dimensionEvidence.unresolvedDimensionIds.length,
      };
    };

    const baselineFidelity = fidelityMetrics(baselineCandidate);
    const simulatedFidelity = fidelityMetrics(simulatedCandidate);
    const fidelitySimulation = summarizeSourceBackedShortRunFidelitySimulation({
      familyLayerSafe,
      baseline: baselineFidelity,
      simulated: simulatedFidelity,
    });

    return NextResponse.json({
      mode: "read_only_source_backed_short_run_fidelity_simulation",
      source: {
        versionId,
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        sheetTitle: String(sheetResponse.data.title || ""),
        originalFilename: String(versionResponse.data.original_filename || ""),
        selectedPage: plan.selectedPage,
        expectedPage: expectedPage ?? null,
      },
      extraction: {
        baselineMinRunPixels: DEFAULT_RASTER_LINE_OPTIONS.minRunPixels,
        sourceEquivalentMinRunPixels,
        baselineRasterSegmentCount: baselineRaster.segments.length,
        simulatedRasterSegmentCount: baselineRaster.segments.length + selectedAdded.length,
        requestedSegmentIds: requestedIds,
      },
      familyLayer: {
        before: {
          uniqueAgreementCount: baselineAgreement.uniqueAgreementCount,
          ambiguousAgreementCount: baselineAgreement.ambiguousAgreementCount,
          noAgreementCount: baselineAgreement.noAgreementCount,
          missingFamilyCount: baselineAgreement.missingFamilyCount,
        },
        after: {
          uniqueAgreementCount: simulatedAgreement.uniqueAgreementCount,
          ambiguousAgreementCount: simulatedAgreement.ambiguousAgreementCount,
          noAgreementCount: simulatedAgreement.noAgreementCount,
          missingFamilyCount: simulatedAgreement.missingFamilyCount,
        },
        newlyUniqueFamilyIds,
        previouslyUniqueRegressionFamilyIds,
        safe: familyLayerSafe,
      },
      fidelitySimulation,
      safety: {
        writesPerformed: false,
        extractionChanged: false,
        sourceSelectionChanged: false,
        canonicalGeometryChanged: false,
        generated3d: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run source-backed Blueprint short-run fidelity simulation." }, { status: 400 });
  }
}
