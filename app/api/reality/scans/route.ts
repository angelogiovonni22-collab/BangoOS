import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { summarizeRoomPlan, validateRealityCaptureInput, type RealityCaptureCreateInput } from "@/lib/reality/capture";

type UntypedSupabase = SupabaseClient<any>;

async function clientForRequest(req:NextRequest):Promise<SupabaseClient<Database>|null> {
  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) return createCookieClient();
  const { url, publishableKey } = getSupabaseEnv();
  if (!url || !publishableKey) return null;
  return createSupabaseJsClient<Database>(url, publishableKey, {
    global:{ headers:{ Authorization:authorization } },
    auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
  });
}

export async function GET(req:NextRequest) {
  const supabase = await clientForRequest(req);
  if (!supabase) return NextResponse.json({ ok:false, error:"Workspace unavailable." }, { status:503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ ok:false, error:workspace.errorMessage || "Unauthorized." }, { status:401 });
  const projectId = new URL(req.url).searchParams.get("projectId")?.trim();
  if (!projectId) return NextResponse.json({ ok:false, error:"projectId is required." }, { status:400 });
  const { data:project } = await supabase.from("projects").select("id").eq("id", projectId).eq("company_id", workspace.context.companyId).maybeSingle();
  if (!project) return NextResponse.json({ ok:false, error:"Project not found in this company." }, { status:404 });
  const db = supabase as unknown as UntypedSupabase;
  const { data, error } = await db.from("reality_capture_sessions")
    .select("id,project_id,blueprint_version_id,capture_type,status,source_platform,device_model,os_version,app_build,spatial_summary,captured_at,created_at")
    .eq("company_id", workspace.context.companyId)
    .eq("project_id", projectId)
    .order("captured_at", { ascending:false })
    .limit(100);
  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  return NextResponse.json({ ok:true, scans:data || [] });
}

export async function POST(req:NextRequest) {
  const supabase = await clientForRequest(req);
  if (!supabase) return NextResponse.json({ ok:false, error:"Workspace unavailable." }, { status:503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ ok:false, error:workspace.errorMessage || "Unauthorized." }, { status:401 });
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok:false, error:"Unauthorized." }, { status:401 });

  let input:RealityCaptureCreateInput;
  try { input = await req.json() as RealityCaptureCreateInput; }
  catch { return NextResponse.json({ ok:false, error:"A JSON capture payload is required." }, { status:400 }); }
  const errors = validateRealityCaptureInput(input);
  if (errors.length) return NextResponse.json({ ok:false, error:errors.join("; ") }, { status:400 });

  const { data:project } = await supabase.from("projects").select("id").eq("id", input.projectId).eq("company_id", workspace.context.companyId).maybeSingle();
  if (!project) return NextResponse.json({ ok:false, error:"Project not found in this company." }, { status:404 });
  const db = supabase as unknown as UntypedSupabase;
  if (input.blueprintVersionId) {
    const { data:version } = await db.from("blueprint_versions").select("id").eq("id", input.blueprintVersionId).eq("company_id", workspace.context.companyId).eq("project_id", input.projectId).maybeSingle();
    if (!version) return NextResponse.json({ ok:false, error:"Blueprint version not found for this project." }, { status:404 });
  }

  const roomPlanPayload = input.roomPlan ?? {};
  const spatialSummary = input.roomPlan ? summarizeRoomPlan(input.roomPlan) : (input.spatialSummary ?? {});
  const { data, error } = await db.from("reality_capture_sessions").insert({
    company_id:workspace.context.companyId,
    project_id:input.projectId,
    blueprint_version_id:input.blueprintVersionId ?? null,
    capture_type:input.captureType,
    status:"captured",
    source_platform:input.sourcePlatform,
    device_model:input.deviceModel ?? null,
    os_version:input.osVersion ?? null,
    app_build:input.appBuild ?? null,
    roomplan_payload:roomPlanPayload,
    spatial_summary:spatialSummary,
    captured_at:input.capturedAt ?? new Date().toISOString(),
    created_by:user.id,
  }).select("id,status,captured_at").single();
  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  return NextResponse.json({ ok:true, scan:data }, { status:201 });
}
