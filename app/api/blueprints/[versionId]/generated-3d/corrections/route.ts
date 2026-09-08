import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { BosGraphCorrection } from "@/lib/blueprints/engine/corrections";
import type { Database } from "@/types/database.types";

function dbClient(supabase: SupabaseClient<Database>) {
  // Migration-backed tables intentionally remain usable before generated Supabase types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

async function context(versionId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const typed = supabase as SupabaseClient<Database>;
  const workspace = await resolveWorkspaceContext(typed);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  const db = dbClient(typed);
  const model = await db.from("blueprint_generated_models")
    .select("id,company_id,project_id,source_version_id,reconstruction_version")
    .eq("company_id", workspace.context.companyId)
    .eq("source_version_id", versionId)
    .maybeSingle();
  if (model.error) throw new Error(model.error.message);
  if (!model.data) throw new Error("Generate or reconstruct this Blueprint before saving corrections.");
  return { db, workspace: workspace.context, model: model.data as Record<string, unknown> };
}

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const { db, model } = await context(versionId);
    const response = await db.from("blueprint_model_corrections")
      .select("id,correction_type,object_id,payload,reconstruction_version,created_by,created_at")
      .eq("company_id", model.company_id)
      .eq("generated_model_id", model.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (response.error) throw new Error(response.error.message);
    return NextResponse.json({ corrections: response.data || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Blueprint corrections." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const { db, workspace, model } = await context(versionId);
    const body = await request.json() as { correction?: BosGraphCorrection };
    const correction = body.correction;
    if (!correction || typeof correction !== "object" || typeof correction.id !== "string" || typeof correction.type !== "string" || typeof correction.createdAt !== "string") {
      return NextResponse.json({ error: "A valid B.O.S. graph correction is required." }, { status: 400 });
    }
    const allowed = new Set(["move_wall", "add_wall", "remove_wall", "classify_wall", "update_opening", "update_room", "set_scale"]);
    if (!allowed.has(correction.type)) return NextResponse.json({ error: "Unsupported Blueprint correction type." }, { status: 400 });

    const objectId = "wallId" in correction ? correction.wallId
      : "openingId" in correction ? correction.openingId
      : "roomId" in correction ? correction.roomId
      : correction.type === "add_wall" ? correction.wall.id
      : null;
    const reconstructionVersion = typeof model.reconstruction_version === "string" ? model.reconstruction_version : "native-1";
    const insert = await db.from("blueprint_model_corrections").insert({
      id: correction.id,
      company_id: model.company_id,
      project_id: model.project_id,
      generated_model_id: model.id,
      source_version_id: model.source_version_id,
      correction_type: correction.type,
      object_id: objectId,
      payload: correction,
      reconstruction_version: reconstructionVersion,
      created_by: workspace.userId,
    }).select("id,correction_type,object_id,payload,reconstruction_version,created_at").single();
    if (insert.error) throw new Error(insert.error.message);
    return NextResponse.json({ correction: insert.data, regenerationRequired: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save Blueprint correction." }, { status: 400 });
  }
}
