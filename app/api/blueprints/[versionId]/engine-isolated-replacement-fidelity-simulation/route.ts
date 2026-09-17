import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import { parsePdfVectorPlan } from "@/lib/blueprints/engine/pdf-vector-parser";
import { normalizeParsedPlan, summarizeSelectedPlan } from "@/lib/blueprints/engine/plan-parser";
import { extractRasterLineSegments } from "@/lib/blueprints/engine/raster";
import { buildRasterArchitecturalCandidate } from "@/lib/blueprints/engine/raster-architectural-candidate";
import { renderBlueprintGraySource, assessSourcePixelOverlay } from "@/lib/blueprints/engine/source-pixel-overlay";
import { buildIndependentSourceWallNetworkEvidence, assessSourceWallNetworkOverlay } from "@/lib/blueprints/engine/source-wall-network-overlay";
import { diagnoseSourcePairFamilyAgreement } from "@/lib/blueprints/engine/source-pair-family-agreement-diagnostic";
import { diagnoseSourcePairRasterPairingGaps } from "@/lib/blueprints/engine/source-pair-raster-pairing-gap-diagnostic";
import { excludeRasterSheetFrameSystems } from "@/lib/blueprints/engine/raster-sheet-frame";
import { selectStructuralRasterWallSystems } from "@/lib/blueprints/engine/raster-structural-selector";
import { solveGlobalWallConstraints } from "@/lib/blueprints/engine/global-constraint-solver";
import { topologyMetrics, type BosRawSegment } from "@/lib/blueprints/engine/geometry";
import type { BosWallFaceEvidence, BosWallSystemCandidate } from "@/lib/blueprints/engine/wall-system-builder";
import { summarizeSourceBackedShortRunFidelitySimulation } from "@/lib/blueprints/engine/source-backed-shortrun-fidelity-simulation";
import type { Database } from "@/types/database.types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const MAX_SOURCE_BYTES = 45 * 1024 * 1024;

type RawFace = {
  id: string;
  primitiveId: string;
  sourcePage: number;
  fixed: number;
  start: number;
  end: number;
  horizontal: boolean;
  confidence: number;
};

function dbClient(supabase: SupabaseClient<Database>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

function segmentLength(segment: BosRawSegment) {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
}

function rawFaces(segments: readonly BosRawSegment[], minLengthMeters = 0.45): RawFace[] {
  return segments
    .filter((segment) => segmentLength(segment) >= minLengthMeters)
    .map((segment, index) => {
      const horizontal = Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y);
      const primitiveId = segment.sourceObjectId || `raster-face-${index}`;
      return {
        id: `${primitiveId}:face-${index}`,
        primitiveId,
        sourcePage: segment.sourcePage,
        fixed: horizontal ? (segment.start.y + segment.end.y) / 2 : (segment.start.x + segment.end.x) / 2,
        start: horizontal ? Math.min(segment.start.x, segment.end.x) : Math.min(segment.start.y, segment.end.y),
        end: horizontal ? Math.max(segment.start.x, segment.end.x) : Math.max(segment.start.y, segment.end.y),
        horizontal,
        confidence: segment.confidence ?? 0.62,
      };
    });
}

function faceEvidence(face: RawFace): BosWallFaceEvidence {
  return {
    id: face.id,
    primitiveId: face.primitiveId,
    sourcePage: face.sourcePage,
    line: face.horizontal
      ? { start: { x: face.start, y: face.fixed }, end: { x: face.end, y: face.fixed } }
      : { start: { x: face.fixed, y: face.start }, end: { x: face.fixed, y: face.end } },
    confidence: face.confidence,
  };
}

function candidateFromFacePair(candidateId: string, left: RawFace, right: RawFace): BosWallSystemCandidate | null {
  if (left.sourcePage !== right.sourcePage || left.horizontal !== right.horizontal) return null;
  const start = Math.max(left.start, right.start);
  const end = Math.min(left.end, right.end);
  if (end <= start) return null;
  const thickness = Math.abs(left.fixed - right.fixed);
  const fixed = (left.fixed + right.fixed) / 2;
  const shorter = Math.max(0.000001, Math.min(left.end - left.start, right.end - right.start));
  const overlapRatio = Math.min(1, (end - start) / shorter);
  const centerline = left.horizontal
    ? { start: { x: start, y: fixed }, end: { x: end, y: fixed } }
    : { start: { x: fixed, y: start }, end: { x: fixed, y: end } };
  return {
    id: candidateId,
    sourcePage: left.sourcePage,
    centerline,
    thickness,
    length: end - start,
    orientationRadians: left.horizontal ? 0 : Math.PI / 2,
    faceA: faceEvidence(left),
    faceB: faceEvidence(right),
    overlapRatio,
    confidence: Math.min(0.98, (left.confidence + right.confidence) / 2),
  };
}

function reconstructReplacementCandidates(segments: readonly BosRawSegment[], targetIds: readonly string[]) {
  const targets = new Set(targetIds);
  const faces = rawFaces(segments);
  const matches = new Map<string, BosWallSystemCandidate>();
  for (let left = 0; left < faces.length; left += 1) {
    for (let right = left + 1; right < faces.length; right += 1) {
      const candidateId = `raster-wall-system-${faces[left].id}-${faces[right].id}`;
      if (!targets.has(candidateId)) continue;
      const candidate = candidateFromFacePair(candidateId, faces[left], faces[right]);
      if (candidate) matches.set(candidateId, candidate);
    }
  }
  return targetIds.flatMap((id) => {
    const candidate = matches.get(id);
    return candidate ? [candidate] : [];
  });
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
    if (versionResponse.data.mime_type !== "application/pdf") return NextResponse.json({ error: "Isolated replacement fidelity simulation requires a PDF Blueprint." }, { status: 415 });
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
    if (!selected.scale.drawingUnitsPerMeter || selected.scale.confidence < 0.55) throw new Error("Verified Blueprint scale is required for isolated replacement fidelity simulation.");

    const raster = await extractRasterLineSegments(buffer, {
      page: plan.selectedPage,
      drawingUnitsPerMeter: selected.scale.drawingUnitsPerMeter,
      sourceWidth: selected.page.width,
      sourceHeight: selected.page.height,
    });
    const baselineCandidate = buildRasterArchitecturalCandidate({
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
      explicitWallSystems: baselineCandidate.sheetFrameSelection.wallSystems,
      ...shared,
    });
    const rasterPairing = diagnoseSourcePairRasterPairingGaps({
      familyAgreement,
      consolidationClusters: sourceEvidence.consolidated.clusters,
      annotationFilteredSegments: baselineCandidate.annotationFiltered,
      explicitWallSystems: baselineCandidate.explicitSystems,
      sheetFrameWallSystems: baselineCandidate.sheetFrameSelection.wallSystems,
      ...shared,
    });
    const replacement = rasterPairing.isolatedReplacementSimulation;
    if (!replacement || !replacement.safeToConsiderPromotion || !replacement.addedCandidateIds.length) {
      throw new Error("No isolated replacement is currently safe enough for independent fidelity simulation.");
    }

    const replacementCandidates = reconstructReplacementCandidates(baselineCandidate.annotationFiltered, replacement.addedCandidateIds);
    if (replacementCandidates.length !== replacement.addedCandidateIds.length) {
      throw new Error("Unable to reconstruct every audited isolated replacement candidate from the exact raster faces.");
    }
    const removedIds = new Set(replacement.removedWallIds);
    const replacedExplicit = [
      ...baselineCandidate.explicitSystems.filter((wall) => !removedIds.has(wall.id)),
      ...replacementCandidates,
    ];
    const replacedSheetFrame = excludeRasterSheetFrameSystems(replacedExplicit, raster.width, raster.height);
    const ordinaryStructural = selectStructuralRasterWallSystems(replacedSheetFrame.wallSystems);
    const protectedStructural = selectStructuralRasterWallSystems(replacedSheetFrame.wallSystems, {
      protectedWallSystemIds: replacement.addedCandidateIds,
    });
    const ordinaryConstrained = solveGlobalWallConstraints(ordinaryStructural.wallSystems, baselineCandidate.dimensionEvidence.dimensions);
    const protectedConstrained = solveGlobalWallConstraints(protectedStructural.wallSystems, baselineCandidate.dimensionEvidence.dimensions);

    const baselinePreselectionPixel = assessSourcePixelOverlay({
      image: sourceImage,
      wallSystems: baselineCandidate.sheetFrameSelection.wallSystems,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });
    const replacedPreselectionPixel = assessSourcePixelOverlay({
      image: sourceImage,
      wallSystems: replacedSheetFrame.wallSystems,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    });

    const metrics = (wallSystems: readonly BosWallSystemCandidate[], preselection: readonly BosWallSystemCandidate[], preselectionPrecision: number) => {
      const pixel = assessSourcePixelOverlay({
        image: sourceImage,
        wallSystems,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
      });
      const network = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
        predictedPrecision: pixel.predictedPrecision,
        evidence: sourceEvidence,
      });
      const preselectionNetwork = assessSourceWallNetworkOverlay({
        image: sourceImage,
        wallSystems: preselection,
        sourceWidthMeters: raster.width,
        sourceHeightMeters: raster.height,
        predictedPrecision: preselectionPrecision,
        evidence: sourceEvidence,
      });
      const supportByWallId = new Map(pixel.perWallSupport.map((item) => [item.wallSystemId, item.support]));
      return {
        wallCount: wallSystems.length,
        preselectionWallCount: preselection.length,
        predictedPrecision: pixel.predictedPrecision,
        sourceWallFaceRecall: pixel.sourceWallFaceRecall,
        sourceNetworkRecall: network.recall,
        preselectionSourceNetworkRecall: preselectionNetwork.recall,
        topologyClosure: topologyMetrics(wallSystems.map((wall) => wall.centerline)).closure,
        unsupportedHighConfidenceWallCount: wallSystems.filter((wall) => wall.confidence >= 0.8 && (supportByWallId.get(wall.id) ?? 0) < 0.95).length,
        dimensionAssociationCount: baselineCandidate.dimensionEvidence.associations.length,
        unresolvedDimensionCount: baselineCandidate.dimensionEvidence.unresolvedDimensionIds.length,
      };
    };

    const baselineMetrics = metrics(
      baselineCandidate.constrained.wallSystems,
      baselineCandidate.sheetFrameSelection.wallSystems,
      baselinePreselectionPixel.predictedPrecision,
    );
    const ordinaryMetrics = metrics(
      ordinaryConstrained.wallSystems,
      replacedSheetFrame.wallSystems,
      replacedPreselectionPixel.predictedPrecision,
    );
    const protectedMetrics = metrics(
      protectedConstrained.wallSystems,
      replacedSheetFrame.wallSystems,
      replacedPreselectionPixel.predictedPrecision,
    );
    const ordinaryFidelity = summarizeSourceBackedShortRunFidelitySimulation({
      familyLayerSafe: replacement.safeToConsiderPromotion,
      baseline: baselineMetrics,
      simulated: ordinaryMetrics,
    });
    const protectedFidelity = summarizeSourceBackedShortRunFidelitySimulation({
      familyLayerSafe: replacement.safeToConsiderPromotion,
      baseline: baselineMetrics,
      simulated: protectedMetrics,
    });

    return NextResponse.json({
      mode: "read_only_isolated_source_replacement_fidelity_simulation",
      source: {
        versionId,
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        sheetTitle: String(sheetResponse.data.title || ""),
        originalFilename: String(versionResponse.data.original_filename || ""),
        selectedPage: plan.selectedPage,
        expectedPage: expectedPage ?? null,
      },
      replacement: {
        removedWallIds: replacement.removedWallIds,
        addedCandidateIds: replacement.addedCandidateIds,
        familyOutcomes: replacement.familyOutcomes,
        safeAtFamilyLayer: replacement.safeToConsiderPromotion,
        reconstructedCandidateCount: replacementCandidates.length,
      },
      selection: {
        baselinePreselectionWallCount: baselineCandidate.sheetFrameSelection.wallSystems.length,
        replacedPreselectionWallCount: replacedSheetFrame.wallSystems.length,
        baselineStructuralWallCount: baselineCandidate.structuralSelection.wallSystems.length,
        ordinaryReplacementStructuralWallCount: ordinaryStructural.wallSystems.length,
        protectedReplacementStructuralWallCount: protectedStructural.wallSystems.length,
        protectedReplacementCount: protectedStructural.protectedWallSystemCount,
      },
      ordinaryReplacementFidelity: ordinaryFidelity,
      protectedReplacementFidelity: protectedFidelity,
      safety: {
        writesPerformed: false,
        extractionChanged: false,
        productionPairingChanged: false,
        selectorDefaultsChanged: false,
        canonicalGeometryChanged: false,
        generated3d: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run isolated replacement fidelity simulation." }, { status: 400 });
  }
}
