import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import {
  buildBlueprintGlb,
  isUsableBlueprint3dAnalysis,
  normalizeBlueprint3dAnalysis,
  type NormalizedBlueprint3dAnalysis,
} from "@/lib/blueprints/automatic-3d";
import type { Database } from "@/types/database.types";

export const maxDuration = 60;

const MAX_AI_SOURCE_BYTES = 45 * 1024 * 1024;
const SOURCE_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

type SourceVersion = {
  id: string;
  company_id: string;
  project_id: string;
  blueprint_sheet_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  page_count: number | null;
  sheet_number: string;
  sheet_title: string;
  discipline: string;
};

type ResponsesCreate = (body: Record<string, unknown>) => Promise<{ output_text?: string }>;

type AnalysisPass = {
  raw: string;
  analysis: NormalizedBlueprint3dAnalysis;
};

function dbClient(supabase: SupabaseClient<Database>) {
  // Migration-backed tables intentionally remain usable before generated Supabase types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

async function getContext(versionId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  const db = dbClient(supabase as SupabaseClient<Database>);
  const sourceResponse = await db
    .from("blueprint_versions")
    .select("id,company_id,project_id,blueprint_sheet_id,storage_path,original_filename,mime_type,file_size_bytes,page_count")
    .eq("id", versionId)
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  if (sourceResponse.error) throw new Error(sourceResponse.error.message);
  if (!sourceResponse.data) throw new Error("Blueprint revision not found.");

  const sheetResponse = await db
    .from("blueprint_sheets")
    .select("sheet_number,title,discipline")
    .eq("id", sourceResponse.data.blueprint_sheet_id)
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  if (sheetResponse.error) throw new Error(sheetResponse.error.message);
  if (!sheetResponse.data) throw new Error("Blueprint sheet metadata not found.");

  const source: SourceVersion = {
    ...sourceResponse.data,
    sheet_number: String(sheetResponse.data.sheet_number || ""),
    sheet_title: String(sheetResponse.data.title || ""),
    discipline: String(sheetResponse.data.discipline || "Architectural"),
  } as SourceVersion;

  return { supabase: supabase as SupabaseClient<Database>, db, workspace: workspace.context, source };
}

async function payloadForModel(supabase: SupabaseClient<Database>, db: ReturnType<typeof dbClient>, source: SourceVersion) {
  const response = await db
    .from("blueprint_generated_models")
    .select("id,status,storage_path,mime_type,confidence,assumptions,generation_model,error_message,updated_at")
    .eq("company_id", source.company_id)
    .eq("source_version_id", source.id)
    .maybeSingle();
  if (response.error) throw new Error(response.error.message);
  const row = response.data as Record<string, unknown> | null;
  if (!row) return { status: "not_generated" as const, model: null };

  let signedUrl: string | null = null;
  if (row.status === "ready" && typeof row.storage_path === "string" && row.storage_path) {
    const signed = await supabase.storage.from(BLUEPRINTS_BUCKET).createSignedUrl(row.storage_path, 60 * 60);
    if (!signed.error) signedUrl = signed.data?.signedUrl || null;
  }
  return {
    status: String(row.status),
    model: {
      id: String(row.id),
      signedUrl,
      mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
      confidence: typeof row.confidence === "number" ? row.confidence : Number(row.confidence ?? 0),
      assumptions: Array.isArray(row.assumptions) ? row.assumptions : [],
      generationModel: typeof row.generation_model === "string" ? row.generation_model : null,
      errorMessage: typeof row.error_message === "string" ? row.error_message : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    },
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const { supabase, db, source } = await getContext(versionId);
    return NextResponse.json(await payloadForModel(supabase, db, source));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load generated 3D status." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  let modelRowId: string | null = null;
  try {
    const { versionId } = await params;
    const { supabase, db, workspace, source } = await getContext(versionId);
    const force = new URL(request.url).searchParams.get("force") === "1";

    if (!SOURCE_MIME_TYPES.has(source.mime_type)) {
      return NextResponse.json({ error: "Automatic 3D generation currently starts from PDF or image plan sheets. Existing IFC/GLB/GLTF files already open directly in the 3D viewer." }, { status: 415 });
    }
    if (source.file_size_bytes <= 0 || source.file_size_bytes > MAX_AI_SOURCE_BYTES) {
      return NextResponse.json({ error: "This plan is too large for automatic 3D analysis. Reduce the source PDF/image below 45 MB or upload a BIM model." }, { status: 413 });
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Automatic Blueprint-to-3D intelligence is not configured on this deployment." }, { status: 503 });
    }

    const existing = await db
      .from("blueprint_generated_models")
      .select("id,storage_path,status")
      .eq("company_id", source.company_id)
      .eq("source_version_id", source.id)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    if (!force && existing.data?.status === "ready" && existing.data.storage_path) {
      return NextResponse.json(await payloadForModel(supabase, db, source));
    }

    if (existing.data?.id) {
      modelRowId = String(existing.data.id);
      const update = await db.from("blueprint_generated_models").update({ status: "processing", error_message: null }).eq("id", modelRowId);
      if (update.error) throw new Error(update.error.message);
    } else {
      const insert = await db.from("blueprint_generated_models").insert({
        company_id: source.company_id,
        project_id: source.project_id,
        source_version_id: source.id,
        status: "processing",
        created_by: workspace.userId,
      }).select("id").single();
      if (insert.error || !insert.data) throw new Error(insert.error?.message || "Unable to start 3D generation.");
      modelRowId = String(insert.data.id);
    }

    const download = await supabase.storage.from(BLUEPRINTS_BUCKET).download(source.storage_path);
    if (download.error || !download.data) throw new Error(download.error?.message || "Unable to read the source Blueprint.");
    const buffer = Buffer.from(await download.data.arrayBuffer());
    const { analysis, modelName } = await analyzePlan(buffer, source);

    if (!isUsableBlueprint3dAnalysis(analysis) || isObviouslyUnderTracedFloorPlan(source, analysis)) {
      await db.from("blueprint_generated_models").update({
        status: "needs_input",
        geometry_json: analysis,
        confidence: Math.min(analysis.confidence, 0.45),
        assumptions: analysis.assumptions,
        generation_model: modelName,
        error_message: `B.O.S. could not trace enough of ${source.sheet_number} · ${source.sheet_title} to produce a faithful conceptual model. The result was intentionally withheld instead of showing an oversimplified building. Verify the registered drawing, scale/dimensions, or add a clearer architectural sheet and retry.`,
      }).eq("id", modelRowId);
      return NextResponse.json(await payloadForModel(supabase, db, source), { status: 422 });
    }

    const glb = buildBlueprintGlb(analysis);
    const storagePath = `${source.company_id}/${source.project_id}/generated-3d/${source.id}/${randomUUID()}-bos-generated.glb`;
    const upload = await supabase.storage.from(BLUEPRINTS_BUCKET).upload(storagePath, glb, { contentType: "model/gltf-binary", upsert: false });
    if (upload.error) throw new Error(upload.error.message);

    const previousStoragePath = typeof existing.data?.storage_path === "string" ? existing.data.storage_path : null;
    const ready = await db.from("blueprint_generated_models").update({
      status: "ready",
      storage_path: storagePath,
      mime_type: "model/gltf-binary",
      geometry_json: analysis,
      confidence: analysis.confidence,
      assumptions: analysis.assumptions,
      generation_model: modelName,
      error_message: null,
    }).eq("id", modelRowId);
    if (ready.error) {
      await supabase.storage.from(BLUEPRINTS_BUCKET).remove([storagePath]);
      throw new Error(ready.error.message);
    }
    if (previousStoragePath && previousStoragePath !== storagePath) {
      await supabase.storage.from(BLUEPRINTS_BUCKET).remove([previousStoragePath]);
    }

    return NextResponse.json(await payloadForModel(supabase, db, source));
  } catch (error) {
    if (modelRowId) {
      try {
        const { versionId } = await params;
        const { db } = await getContext(versionId);
        await db.from("blueprint_generated_models").update({
          status: "failed",
          error_message: error instanceof Error ? error.message.slice(0, 1000) : "Automatic 3D generation failed.",
        }).eq("id", modelRowId);
      } catch {
        // Preserve the original generation error even if status recording also fails.
      }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automatic 3D generation failed." }, { status: 500 });
  }
}

async function analyzePlan(buffer: Buffer, source: SourceVersion): Promise<{ analysis: NormalizedBlueprint3dAnalysis; modelName: string }> {
  const modelName = process.env.BANGO_BLUEPRINT_3D_MODEL || "gpt-4o";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 1 });
  const target = `${source.sheet_number} · ${source.sheet_title}`;
  const multiPageRule = source.mime_type === "application/pdf" && (source.page_count || 1) > 1
    ? `This PDF contains ${source.page_count} pages. Locate the page/drawing whose title, sheet label, or content best matches the registered B.O.S. sheet \"${target}\" (${source.discipline}). Reconstruct ONLY that matching drawing. Do not reconstruct a basement/foundation plan, second floor plan, roof plan, elevation, detail, or other page merely because it appears first in the PDF.`
    : `The registered B.O.S. sheet is \"${target}\" (${source.discipline}). Reconstruct that drawing only.`;

  const geometryRules = `Trace the target drawing as architectural geometry, not as a simplified room diagram. Return one wall entry for EACH straight wall centerline segment that is actually visible. For a house, the exterior perimeter often needs many segments because of garages, entries, decks, porches, bays, offsets, bump-outs, and jogs; do not replace these with a four-wall bounding rectangle. Trace the full exterior perimeter first, then add all major interior partitions needed to make the 3D footprint visibly resemble the plan. Preserve stairs/cores as surrounding walls when they materially affect the plan shape. Labels should begin with \"Exterior\" or \"Interior\" so B.O.S. can audit completeness. Prefer printed dimensions over visual guesses. Do not invent geometry contradicted by the sheet.`;

  const prompt = `${multiPageRule}\n\nAnalyze the target architectural plan for a conceptual B.O.S. 3D reconstruction. Return JSON only with: units (ft or m), ceilingHeight, floorThickness, confidence (0-1), assumptions (array of strings), notes (array), walls (array). Each wall must contain x1,y1,x2,y2,thickness,height,label. Use one consistent plan coordinate system with the lower-left of the complete visible building footprint near 0,0. ${geometryRules} In notes, explicitly name the drawing/page you selected and summarize the major footprint elements you traced. If you cannot identify a drawing matching \"${target}\", return an empty walls array and explain the mismatch in notes instead of modeling a different sheet. If wall height is not shown, use 8 ft and state that assumption. If wall thickness is unclear, use 0.5 ft and state that assumption. This is a conceptual coordination model, not construction-authoritative BIM.`;

  const first = await runAnalysisPass(client, modelName, buffer, source, prompt);
  let final = first;

  if (shouldRunFidelityPass(source, first.analysis)) {
    const refinementPrompt = `${multiPageRule}\n\nA first-pass reconstruction produced only ${first.analysis.walls.length} wall segments. Treat that as a DRAFT, not as truth. Re-open the source and visually compare the target drawing against the draft JSON below. Return a corrected FULL reconstruction JSON using the same schema. Count every exterior change of direction and every major interior partition visible on the target plan. The final wall network must visibly resemble the plan when extruded. Do not preserve a rectangular bounding box if the drawing contains attached garages, offsets, entry projections, decks/porches, bays, or other perimeter changes. Do not omit major rooms/partitions just to reduce wall count. If the source truly is simple, keep it simple; otherwise trace the complexity you can actually see. ${geometryRules}\n\nFIRST PASS JSON:\n${first.raw.slice(0, 18000)}`;
    final = await runAnalysisPass(client, modelName, buffer, source, refinementPrompt);
  }

  return { analysis: final.analysis, modelName };
}

async function runAnalysisPass(client: OpenAI, modelName: string, buffer: Buffer, source: SourceVersion, prompt: string): Promise<AnalysisPass> {
  let raw = "{}";

  if (source.mime_type.startsWith("image/")) {
    const dataUrl = `data:${source.mime_type};base64,${buffer.toString("base64")}`;
    const completion = await client.chat.completions.create({
      model: modelName,
      temperature: 0,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You reconstruct architectural floor-plan geometry for B.O.S. Never substitute a different drawing for the registered sheet. Trace the complete visible footprint and major partitions. Return only strict JSON and clearly report assumptions." },
        { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl, detail: "high" } }] },
      ],
    });
    raw = completion.choices[0]?.message?.content || "{}";
  } else {
    const createResponse = client.responses.create.bind(client.responses) as unknown as ResponsesCreate;
    const response = await createResponse({
      model: modelName,
      instructions: "You reconstruct architectural floor-plan geometry for B.O.S. Never substitute a different drawing for the registered sheet. Trace the complete visible footprint and major partitions. Return only strict JSON and clearly report assumptions.",
      input: [{
        role: "user",
        content: [
          { type: "input_file", filename: source.original_filename, file_data: `data:${source.mime_type};base64,${buffer.toString("base64")}` },
          { type: "input_text", text: prompt },
        ],
      }],
      store: false,
    });
    raw = response.output_text || "{}";
  }

  let parsed: unknown = {};
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    parsed = {};
  }
  return { raw, analysis: normalizeBlueprint3dAnalysis(parsed) };
}

function shouldRunFidelityPass(source: SourceVersion, analysis: NormalizedBlueprint3dAnalysis) {
  const title = `${source.sheet_number} ${source.sheet_title}`.toLowerCase();
  const isFloorPlan = title.includes("floor") && title.includes("plan");
  if (!isFloorPlan) return analysis.walls.length < 8;
  const exteriorWalls = analysis.walls.filter((wall) => wall.label?.toLowerCase().startsWith("exterior")).length;
  return analysis.walls.length < 18 || exteriorWalls < 8;
}

function isObviouslyUnderTracedFloorPlan(source: SourceVersion, analysis: NormalizedBlueprint3dAnalysis) {
  const title = `${source.sheet_number} ${source.sheet_title}`.toLowerCase();
  const isFloorPlan = title.includes("floor") && title.includes("plan");
  if (!isFloorPlan) return false;
  const exteriorWalls = analysis.walls.filter((wall) => wall.label?.toLowerCase().startsWith("exterior")).length;
  return analysis.walls.length < 10 || exteriorWalls < 4;
}

function stripJsonFence(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
