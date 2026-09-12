import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import { DEFAULT_RASTER_LINE_OPTIONS, renderBlueprintPdfPage } from "@/lib/blueprints/engine/raster";
import type { BosBuildingGraph } from "@/lib/blueprints/engine/building-graph";
import { BLUEPRINT_GEOMETRY_LOCK_VERSION, assessBlueprintFidelity, renderBlueprintGeometryLock } from "@/lib/blueprints/geometry-lock";
import {
  BLUEPRINT_VISUAL_DISCLAIMER,
  BLUEPRINT_VISUAL_PROMPT_VERSION,
  buildBlueprintWallDistanceSchedule,
  buildBlueprintVisualPrompt,
  generateBlueprintVisual,
  normalizeBlueprintVisualOptions,
  summarizeBlueprintGraph,
} from "@/lib/blueprints/visual-mockup";
import type { Database } from "@/types/database.types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_SOURCE_BYTES = 45 * 1024 * 1024;
const SOURCE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

type SourceRow = {
  id: string;
  company_id: string;
  project_id: string;
  blueprint_sheet_id: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  sheet_number: string;
  sheet_title: string;
};

function dbClient(supabase: SupabaseClient<Database>) {
  // Migration-backed visual mockup records intentionally remain usable before generated types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

async function getContext(versionId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const typed = supabase as SupabaseClient<Database>;
  const workspace = await resolveWorkspaceContext(typed);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  const db = dbClient(typed);
  const sourceResponse = await db.from("blueprint_versions")
    .select("id,company_id,project_id,blueprint_sheet_id,storage_path,mime_type,file_size_bytes")
    .eq("id", versionId)
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  if (sourceResponse.error) throw new Error(sourceResponse.error.message);
  if (!sourceResponse.data) throw new Error("Blueprint revision not found.");
  const sheetResponse = await db.from("blueprint_sheets").select("sheet_number,title")
    .eq("id", sourceResponse.data.blueprint_sheet_id)
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  if (sheetResponse.error) throw new Error(sheetResponse.error.message);
  if (!sheetResponse.data) throw new Error("Blueprint sheet metadata not found.");
  return {
    supabase: typed,
    db,
    workspace: workspace.context,
    source: {
      ...sourceResponse.data,
      sheet_number: String(sheetResponse.data.sheet_number || ""),
      sheet_title: String(sheetResponse.data.title || ""),
    } as SourceRow,
  };
}

async function mockupPayload(supabase: SupabaseClient<Database>, db: ReturnType<typeof dbClient>, source: SourceRow) {
  const response = await db.from("blueprint_visual_mockups")
    .select("id,status,source_page,generated_model_id,storage_path,mime_type,generation_provider,generation_model,prompt_template_version,options,review_metadata,safety_disclaimer,error_message,created_at,updated_at")
    .eq("company_id", source.company_id)
    .eq("project_id", source.project_id)
    .eq("source_version_id", source.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (response.error) throw new Error(response.error.message);
  if (!response.data) return { status: "not_generated", mockup: null };
  const row = response.data as Record<string, unknown>;
  let wallDistances = buildBlueprintWallDistanceSchedule(null);
  if (typeof row.generated_model_id === "string") {
    const modelResponse = await db.from("blueprint_generated_models")
      .select("building_graph")
      .eq("id", row.generated_model_id)
      .eq("company_id", source.company_id)
      .eq("project_id", source.project_id)
      .eq("source_version_id", source.id)
      .maybeSingle();
    if (!modelResponse.error && modelResponse.data?.building_graph) {
      wallDistances = buildBlueprintWallDistanceSchedule(modelResponse.data.building_graph as BosBuildingGraph);
    }
  }
  let signedUrl: string | null = null;
  if ((row.status === "ready" || row.status === "needs_review") && typeof row.storage_path === "string") {
    const signed = await supabase.storage.from(BLUEPRINTS_BUCKET).createSignedUrl(row.storage_path, 60 * 30);
    if (!signed.error) signedUrl = signed.data?.signedUrl || null;
  }
  return {
    status: String(row.status),
    mockup: {
      id: String(row.id),
      signedUrl,
      mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
      sourcePage: Number(row.source_page),
      generatedModelId: typeof row.generated_model_id === "string" ? row.generated_model_id : null,
      generationProvider: typeof row.generation_provider === "string" ? row.generation_provider : null,
      generationModel: typeof row.generation_model === "string" ? row.generation_model : null,
      promptTemplateVersion: String(row.prompt_template_version),
      options: row.options,
      reviewMetadata: row.review_metadata,
      disclaimer: String(row.safety_disclaimer || BLUEPRINT_VISUAL_DISCLAIMER),
      errorMessage: typeof row.error_message === "string" ? row.error_message : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      wallDistances,
    },
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const { supabase, db, source } = await getContext(versionId);
    return NextResponse.json(await mockupPayload(supabase, db, source), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load the visual mockup." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  let rowId: string | null = null;
  try {
    const { versionId } = await params;
    const { supabase, db, workspace, source } = await getContext(versionId);
    if (!SOURCE_MIME_TYPES.has(source.mime_type)) return NextResponse.json({ error: "Visual mockups require a registered PDF or image Blueprint." }, { status: 415 });
    if (source.file_size_bytes <= 0 || source.file_size_bytes > MAX_SOURCE_BYTES) return NextResponse.json({ error: "This Blueprint is too large for visual mockup generation." }, { status: 413 });

    let body: unknown = {};
    try { body = await request.json(); } catch { body = {}; }
    const options = normalizeBlueprintVisualOptions(body);
    const inFlight = await db.from("blueprint_visual_mockups").select("id,status")
      .eq("company_id", source.company_id)
      .eq("project_id", source.project_id)
      .eq("source_version_id", source.id)
      .in("status", ["queued", "processing"])
      .limit(1)
      .maybeSingle();
    if (inFlight.error) throw new Error(inFlight.error.message);
    if (inFlight.data) return NextResponse.json({ error: "A visual mockup is already being generated for this Blueprint revision." }, { status: 409 });
    const modelResponse = await db.from("blueprint_generated_models")
      .select("id,building_graph,source_page,engine_status,correction_history")
      .eq("company_id", source.company_id)
      .eq("project_id", source.project_id)
      .eq("source_version_id", source.id)
      .maybeSingle();
    if (modelResponse.error) throw new Error(modelResponse.error.message);
    const model = modelResponse.data as { id?: string; building_graph?: BosBuildingGraph | null; source_page?: number | null; engine_status?: string | null; correction_history?: unknown[] | null } | null;
    if (!model?.source_page) return NextResponse.json({ error: "Generate the Interactive 3D Model first so B.O.S. can deterministically select the authoritative source page." }, { status: 409 });
    const sourcePage = Number(model.source_page);
    const graph = model.building_graph && typeof model.building_graph === "object" ? model.building_graph : null;
    const fidelity = assessBlueprintFidelity(graph, sourcePage);
    if (!fidelity.allowed || !graph) {
      return NextResponse.json({
        error: "Layout-faithful generation is blocked until the Building Graph passes structural review.",
        fidelityGate: fidelity,
      }, { status: 409 });
    }
    const insert = await db.from("blueprint_visual_mockups").insert({
      company_id: source.company_id,
      project_id: source.project_id,
      source_version_id: source.id,
      source_page: sourcePage,
      generated_model_id: model.id || null,
      status: "queued",
      prompt_template_version: BLUEPRINT_VISUAL_PROMPT_VERSION,
      options,
      review_metadata: { disclaimer: BLUEPRINT_VISUAL_DISCLAIMER },
      created_by: workspace.userId,
    }).select("id").single();
    if (insert.error || !insert.data) throw new Error(insert.error?.message || "Unable to queue the visual mockup.");
    rowId = String(insert.data.id);
    const processing = await db.from("blueprint_visual_mockups").update({ status: "processing" }).eq("id", rowId).eq("company_id", source.company_id);
    if (processing.error) throw new Error(processing.error.message);

    const downloaded = await supabase.storage.from(BLUEPRINTS_BUCKET).download(source.storage_path);
    if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message || "Unable to read the source Blueprint.");
    const sourceBuffer = Buffer.from(await downloaded.data.arrayBuffer());
    const sourceImage = source.mime_type === "application/pdf"
      ? await renderBlueprintPdfPage(sourceBuffer, { ...DEFAULT_RASTER_LINE_OPTIONS, maxDimension: 2048 }, sourcePage)
      : sourceBuffer;
    const sourceMimeType = source.mime_type === "application/pdf" ? "image/png" : source.mime_type as "image/png" | "image/jpeg" | "image/webp";
    const geometryLockImage = await renderBlueprintGeometryLock(graph);
    const prompt = buildBlueprintVisualPrompt({
      sheetIdentity: `${source.sheet_number} · ${source.sheet_title}`,
      sourcePage,
      options,
      graph,
      correctionCount: Array.isArray(model.correction_history) ? model.correction_history.length : 0,
    });
    const generated = await generateBlueprintVisual({
      sourceImage,
      sourceMimeType,
      geometryLockImage,
      prompt,
      telemetry: {
        companyId: source.company_id,
        actorUserId: workspace.userId,
        sourceVersionId: source.id,
      },
    });
    if (!generated.image.length || generated.image.length > 25 * 1024 * 1024) throw new Error("The generated image was empty or exceeded the safe output limit.");
    const storagePath = `${source.company_id}/${source.project_id}/visual-mockups/${source.id}/${randomUUID()}-bos-visual-mockup.png`;
    const upload = await supabase.storage.from(BLUEPRINTS_BUCKET).upload(storagePath, generated.image, { contentType: "image/png", upsert: false });
    if (upload.error) throw new Error(upload.error.message);

    const graphSummary = summarizeBlueprintGraph(graph, Array.isArray(model.correction_history) ? model.correction_history.length : 0);
    const expectedFacts = {
      sourceRevisionId: source.id,
      sourcePage,
      expectedFloorCount: 1,
      garagePresent: graphSummary?.garagePresent ?? null,
      deckPorchPresent: graphSummary?.deckPorchPresent ?? null,
      stairPresent: graphSummary?.stairPresent ?? null,
      footprintOrientation: graphSummary?.footprintOrientation ?? null,
    };
    const status = model.engine_status === "needs_review" ? "needs_review" : "ready";
    const ready = await db.from("blueprint_visual_mockups").update({
      status,
      storage_path: storagePath,
      mime_type: "image/png",
      generation_provider: generated.provider,
      generation_model: generated.model,
      review_metadata: {
        disclaimer: BLUEPRINT_VISUAL_DISCLAIMER,
        sourceBindingVerified: true,
        selectedPageVerified: true,
        graphContextIncluded: Boolean(graph),
        geometryLocked: true,
        geometryLockVersion: BLUEPRINT_GEOMETRY_LOCK_VERSION,
        fidelityGate: fidelity,
        sourceGraphStatus: model.engine_status || null,
        expectedFacts,
      },
      error_message: null,
    }).eq("id", rowId).eq("company_id", source.company_id);
    if (ready.error) {
      await supabase.storage.from(BLUEPRINTS_BUCKET).remove([storagePath]);
      throw new Error(ready.error.message);
    }
    return NextResponse.json(await mockupPayload(supabase, db, source));
  } catch (error) {
    if (rowId) {
      try {
        const { versionId } = await params;
        const { db, source } = await getContext(versionId);
        await db.from("blueprint_visual_mockups").update({
          status: "failed",
          storage_path: null,
          mime_type: null,
          error_message: (error instanceof Error ? error.message : "Visual mockup generation failed.").slice(0, 1000),
        }).eq("id", rowId).eq("company_id", source.company_id);
      } catch {
        // Preserve the original provider/storage failure if status recording also fails.
      }
    }
    const message = error instanceof Error ? error.message : "Visual mockup generation failed.";
    const status = /invalid visual mockup options/i.test(message) ? 400 : /not configured/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
