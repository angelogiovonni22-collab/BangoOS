import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { BosBuildingGraph } from "@/lib/blueprints/engine/building-graph";
import { buildBosBuildingGraphGlb } from "@/lib/blueprints/engine/graph-to-glb";
import { buildBosBuildingGraphIfc } from "@/lib/blueprints/engine/graph-to-ifc";
import { assembleValidatedMultiFloorGraph, discoverBlueprintLevelSheets, selectMultiFloorLevel } from "@/lib/blueprints/engine/multi-floor-orchestration";
import type { Database } from "@/types/database.types";

function dbClient(supabase: SupabaseClient<Database>) {
  // Blueprint Engine migration-backed fields intentionally remain usable before generated types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

type ModelRow = {
  source_version_id: string;
  building_graph: BosBuildingGraph | null;
  engine_status: string | null;
  status: string | null;
};

async function loadMultiFloor(versionId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const typed = supabase as SupabaseClient<Database>;
  const workspace = await resolveWorkspaceContext(typed);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  const db = dbClient(typed);

  const anchor = await db.from("blueprint_versions")
    .select("id,company_id,project_id")
    .eq("id", versionId)
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  if (anchor.error) throw new Error(anchor.error.message);
  if (!anchor.data) throw new Error("Blueprint revision not found.");

  const sheets = await db.from("blueprint_sheets")
    .select("id,sheet_number,title,discipline")
    .eq("company_id", anchor.data.company_id)
    .eq("project_id", anchor.data.project_id)
    .order("sort_order", { ascending: true });
  if (sheets.error) throw new Error(sheets.error.message);
  const sheetRows = (sheets.data || []) as Array<Record<string, unknown>>;
  if (!sheetRows.length) return { candidates: [], models: new Map<string, ModelRow>(), anchor: anchor.data };

  const sheetIds = sheetRows.map((row) => String(row.id));
  const versions = await db.from("blueprint_versions")
    .select("id,blueprint_sheet_id,version_number")
    .eq("company_id", anchor.data.company_id)
    .eq("project_id", anchor.data.project_id)
    .in("blueprint_sheet_id", sheetIds)
    .order("version_number", { ascending: false });
  if (versions.error) throw new Error(versions.error.message);

  const latestBySheet = new Map<string, string>();
  for (const row of (versions.data || []) as Array<Record<string, unknown>>) {
    const sheetId = String(row.blueprint_sheet_id);
    if (!latestBySheet.has(sheetId)) latestBySheet.set(sheetId, String(row.id));
  }

  const candidates = discoverBlueprintLevelSheets(sheetRows.flatMap((sheet) => {
    const sheetId = String(sheet.id);
    const latest = latestBySheet.get(sheetId);
    if (!latest) return [];
    return [{
      sheetId,
      versionId: latest,
      sheetNumber: String(sheet.sheet_number || ""),
      title: String(sheet.title || ""),
      discipline: String(sheet.discipline || ""),
    }];
  }));

  const modelMap = new Map<string, ModelRow>();
  if (candidates.length) {
    const generated = await db.from("blueprint_generated_models")
      .select("source_version_id,building_graph,engine_status,status")
      .eq("company_id", anchor.data.company_id)
      .eq("project_id", anchor.data.project_id)
      .in("source_version_id", candidates.map((item) => item.versionId));
    if (generated.error) throw new Error(generated.error.message);
    for (const row of (generated.data || []) as ModelRow[]) modelMap.set(String(row.source_version_id), row);
  }
  return { candidates, models: modelMap, anchor: anchor.data };
}

function assemblyStatus(loaded: Awaited<ReturnType<typeof loadMultiFloor>>) {
  const ready = loaded.candidates.flatMap((candidate) => {
    const model = loaded.models.get(candidate.versionId);
    if (!model?.building_graph || model.engine_status !== "reconstructed" || model.status !== "ready") return [];
    return [{ candidate, graph: model.building_graph }];
  });
  const missingVersionIds = loaded.candidates.filter((candidate) => !ready.some((item) => item.candidate.versionId === candidate.versionId)).map((candidate) => candidate.versionId);
  const assembly = ready.length === loaded.candidates.length && ready.length >= 2
    ? assembleValidatedMultiFloorGraph(ready.map((item) => ({ graph: item.graph, candidate: item.candidate })))
    : null;
  return { ready, missingVersionIds, assembly };
}

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const loaded = await loadMultiFloor(versionId);
    const state = assemblyStatus(loaded);
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const levelId = url.searchParams.get("level");

    if (!format) {
      return NextResponse.json({
        status: loaded.candidates.length < 2 ? "single_level" : state.missingVersionIds.length ? "needs_generation" : state.assembly?.alignmentValidation.valid ? "ready" : "needs_review",
        levels: loaded.candidates.map((candidate) => ({
          levelId: candidate.levelIndex < 0 ? `level-basement-${Math.abs(candidate.levelIndex)}` : `level-${candidate.levelIndex + 1}`,
          versionId: candidate.versionId,
          sheetNumber: candidate.sheetNumber,
          title: candidate.title,
          name: candidate.levelName,
          elevation: candidate.elevation,
          ready: !state.missingVersionIds.includes(candidate.versionId),
        })),
        missingVersionIds: state.missingVersionIds,
        alignment: state.assembly ? {
          valid: state.assembly.alignmentValidation.valid,
          minimumConfidence: state.assembly.alignmentValidation.minimumConfidence,
          issues: state.assembly.alignmentValidation.issues,
          anchors: state.assembly.alignments,
        } : null,
      });
    }

    if (format !== "glb" && format !== "ifc") return NextResponse.json({ error: "Use format=glb or format=ifc for multi-floor output." }, { status: 400 });
    if (loaded.candidates.length < 2) return NextResponse.json({ error: "At least two architectural level sheets are required for multi-floor output." }, { status: 409 });
    if (state.missingVersionIds.length || !state.assembly) return NextResponse.json({ error: "Every discovered floor must have a validated native reconstruction before multi-floor output.", missingVersionIds: state.missingVersionIds }, { status: 409 });
    if (!state.assembly.alignmentValidation.valid) return NextResponse.json({ error: "Multi-floor alignment requires review before output.", issues: state.assembly.alignmentValidation.issues }, { status: 422 });

    const graph = selectMultiFloorLevel(state.assembly.graph, levelId);
    if (format === "ifc") {
      const ifc = buildBosBuildingGraphIfc(graph);
      return new Response(ifc, {
        headers: {
          "Content-Type": "application/x-step; charset=utf-8",
          "Content-Disposition": `attachment; filename="bos-multifloor-${versionId}.ifc"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const glb = buildBosBuildingGraphGlb(graph);
    return new Response(new Uint8Array(glb), {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Disposition": `inline; filename="bos-multifloor-${versionId}.glb"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to assemble Blueprint floors." }, { status: 400 });
  }
}
