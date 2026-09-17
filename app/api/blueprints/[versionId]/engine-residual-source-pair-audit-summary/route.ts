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
import { auditResidualSourcePairs } from "@/lib/blueprints/engine/residual-source-pair-audit";
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
    if (versionResponse.data.mime_type !== "application/pdf") {
      return NextResponse.json({ error: "B.O.S. residual source-pair audit currently requires a PDF Blueprint." }, { status: 415 });
    }
    const fileSize = Number(versionResponse.data.file_size_bytes || 0);
    if (fileSize <= 0 || fileSize > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "Blueprint source is outside the safe read-only audit size limit." }, { status: 413 });
    }

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
    if (expectedPage && plan.selectedPage !== expectedPage) {
      throw new Error(`Expected Blueprint page ${expectedPage}, but parser selected page ${plan.selectedPage}.`);
    }
    const selected = summarizeSelectedPlan(plan, "level-1");
    if (!selected.scale.drawingUnitsPerMeter || selected.scale.confidence < 0.55) {
      throw new Error("Verified Blueprint scale is required for residual source-pair audit.");
    }

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
    const auditInput = {
      explicitWallSystems: candidate.sheetFrameSelection.wallSystems,
      sourcePixelWidth: sourceImage.width,
      sourcePixelHeight: sourceImage.height,
      sourceWidthMeters: raster.width,
      sourceHeightMeters: raster.height,
    };
    const audit = auditResidualSourcePairs({ retainedSourcePairs: sourceEvidence.network.wallFacePairs, ...auditInput });
    const unmatched = audit.pairs.filter((pair) => pair.reason === "no_explicit_match");
    const mismatchSummary = unmatched.reduce((summary, pair) => {
      const coordinate = pair.nearestCoordinateErrorMeters ?? Number.POSITIVE_INFINITY;
      const thickness = pair.nearestThicknessErrorMeters ?? Number.POSITIVE_INFINITY;
      const coverage = pair.nearestSourceSpanCoverageRatio ?? 0;
      if (coordinate > 0.02) summary.coordinateGate += 1;
      if (thickness > 0.02) summary.thicknessGate += 1;
      if (coverage < 0.9) summary.coverageGate += 1;
      if (coordinate <= 0.02 && thickness <= 0.02 && coverage < 0.9) summary.coverageOnly += 1;
      if (coordinate <= 0.02 && thickness > 0.02 && coverage >= 0.9) summary.thicknessOnly += 1;
      if (coordinate > 0.02 && thickness <= 0.02 && coverage >= 0.9) summary.coordinateOnly += 1;
      return summary;
    }, { coordinateGate: 0, thicknessGate: 0, coverageGate: 0, coordinateOnly: 0, thicknessOnly: 0, coverageOnly: 0 });

    const clusterByRepresentative = new Map(sourceEvidence.consolidated.clusters.map((cluster) => [cluster.representativePairId, cluster]));
    const recoveryClusters = unmatched
      .map((pair) => ({ pair, cluster: clusterByRepresentative.get(pair.pairId) }))
      .filter((item) => item.cluster && item.cluster.members.length >= 2);
    const uniqueMembers = [...new Map(recoveryClusters.flatMap((item) => item.cluster!.members).map((member) => [member.id, member])).values()];
    const memberAudit = auditResidualSourcePairs({ retainedSourcePairs: uniqueMembers, ...auditInput });
    const memberResultById = new Map(memberAudit.pairs.map((pair) => [pair.pairId, pair]));

    const familyMemberRecoveries = recoveryClusters.flatMap(({ pair, cluster }) => {
      const memberMatches = cluster!.members.flatMap((member) => {
        const memberResult = memberResultById.get(member.id);
        if (!memberResult || memberResult.reason !== "unique_explicit_match" || memberResult.eligibleMatches.length !== 1) return [];
        const match = memberResult.eligibleMatches[0];
        return [{
          memberPairId: member.id,
          wallId: match.wallId,
          sourceLengthMeters: memberResult.sourceLengthMeters,
          coordinateErrorMeters: match.coordinateErrorMeters,
          thicknessErrorMeters: match.thicknessErrorMeters,
          sourceSpanCoverageRatio: match.sourceSpanCoverageRatio,
          sourceThicknessMeters: match.sourceThicknessMeters,
          candidateThicknessMeters: match.candidateThicknessMeters,
        }];
      });
      const wallIds = [...new Set(memberMatches.map((match) => match.wallId))];
      if (wallIds.length !== 1) return [];
      const best = [...memberMatches].sort((a, b) =>
        (a.coordinateErrorMeters + a.thicknessErrorMeters + (1 - a.sourceSpanCoverageRatio))
        - (b.coordinateErrorMeters + b.thicknessErrorMeters + (1 - b.sourceSpanCoverageRatio))
        || b.sourceLengthMeters - a.sourceLengthMeters
        || a.memberPairId.localeCompare(b.memberPairId))[0];
      if (!best) return [];
      return [{
        representativePairId: pair.pairId,
        representativeSourceLengthMeters: pair.sourceLengthMeters,
        familySize: cluster!.members.length,
        qualifyingMemberCount: memberMatches.length,
        wallId: wallIds[0],
        bestMember: best,
      }];
    }).sort((a, b) => b.representativeSourceLengthMeters - a.representativeSourceLengthMeters || a.representativePairId.localeCompare(b.representativePairId));

    const recoverableSourceLengthMeters = familyMemberRecoveries.reduce((sum, item) => sum + item.representativeSourceLengthMeters, 0);
    return NextResponse.json({
      mode: "read_only_residual_source_pair_audit_summary",
      source: {
        versionId,
        sheetNumber: String(sheetResponse.data.sheet_number || ""),
        sheetTitle: String(sheetResponse.data.title || ""),
        originalFilename: String(versionResponse.data.original_filename || ""),
        selectedPage: plan.selectedPage,
        expectedPage: expectedPage ?? null,
      },
      preselection: {
        explicitWallSystemCount: candidate.sheetFrameSelection.wallSystems.length,
        selectedWallSystemCount: candidate.structuralSelection.wallSystems.length,
      },
      audit: {
        sourcePairCount: audit.sourcePairCount,
        uniquelyRepresentedPairCount: audit.uniquelyRepresentedPairCount,
        ambiguousPairCount: audit.ambiguousPairCount,
        unmatchedPairCount: audit.unmatchedPairCount,
        unmatchedSourceLengthMeters: audit.unmatchedSourceLengthMeters,
        unmatchedSourceLengthRatio: audit.unmatchedSourceLengthRatio,
        mismatchSummary,
        familyMemberRecovery: {
          recoverableRepresentativePairCount: familyMemberRecoveries.length,
          recoverableRepresentativePairIds: familyMemberRecoveries.map((item) => item.representativePairId),
          recoverableSourceLengthMeters,
          recoverableShareOfUnmatchedLength: audit.unmatchedSourceLengthMeters > 0 ? recoverableSourceLengthMeters / audit.unmatchedSourceLengthMeters : 0,
          recoveries: familyMemberRecoveries,
        },
      },
      safety: {
        writesPerformed: false,
        extractionChanged: false,
        sourceFamilyRepresentativeChanged: false,
        selectorDefaultsChanged: false,
        canonicalGeometryChanged: false,
        generated3d: false,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run residual source-pair audit summary." }, { status: 400 });
  }
}
