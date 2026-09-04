import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const BUCKET = "reality-scans";
const MAX_JSON_BYTES = 25 * 1024 * 1024;
const MAX_MODEL_BYTES = 500 * 1024 * 1024;
const CAPTURE_PROVIDERS = new Set(["apple_roomplan", "arkit_lidar", "manual_import"]);
const CAPTURE_KINDS = new Set(["room", "structure"]);

type UntypedSupabase = {
  from: (table: string) => {
    select: (columns: string) => unknown;
    insert: (payload: unknown) => unknown;
  };
};

type ScanRow = {
  id: string;
  company_id: string;
  project_id: string | null;
  estimate_id: string | null;
  label: string;
  capture_provider: string;
  capture_kind: string;
  status: string;
  source_json_path: string | null;
  model_path: string | null;
  device_model: string | null;
  operating_system: string | null;
  framework_version: string | null;
  room_count: number | null;
  floor_area_sqft: number | null;
  wall_area_sqft: number | null;
  opening_count: number | null;
  object_count: number | null;
  metadata: Record<string, unknown> | null;
  captured_at: string | null;
  created_at: string;
};

function optionalNumber(value: FormDataEntryValue | null) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function safeFileName(fileName: string, fallback: string) {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
  return cleaned || fallback;
}

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Workspace unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ ok: false, error: workspace.errorMessage || "Unauthorized." }, { status: 401 });

  const [projects, estimates] = await Promise.all([
    supabase.from("projects").select("id,name,project_number").eq("company_id", workspace.context.companyId).order("updated_at", { ascending: false }).limit(100),
    supabase.from("estimates").select("id,title,estimate_number,status").eq("company_id", workspace.context.companyId).order("updated_at", { ascending: false }).limit(100),
  ]);

  const realityDb = supabase as unknown as UntypedSupabase;
  const query = realityDb.from("reality_scans").select("id,company_id,project_id,estimate_id,label,capture_provider,capture_kind,status,source_json_path,model_path,device_model,operating_system,framework_version,room_count,floor_area_sqft,wall_area_sqft,opening_count,object_count,metadata,captured_at,created_at") as ReturnType<typeof supabase.from>;
  const { data, error } = await query.eq("company_id", workspace.context.companyId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const scans = await Promise.all(((data || []) as unknown as ScanRow[]).map(async (scan) => {
    if (!scan.model_path) return { ...scan, modelUrl: null };
    const signed = await supabase.storage.from(BUCKET).createSignedUrl(scan.model_path, 60 * 60);
    return { ...scan, modelUrl: signed.data?.signedUrl || null };
  }));

  return NextResponse.json({ ok: true, projects: projects.data || [], estimates: estimates.data || [], scans });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok: false, error: "Workspace unavailable." }, { status: 503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ ok: false, error: workspace.errorMessage || "Unauthorized." }, { status: 401 });
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const form = await req.formData();
  const targetType = String(form.get("targetType") || "");
  const targetId = String(form.get("targetId") || "");
  const label = String(form.get("label") || "").trim();
  const captureProvider = String(form.get("captureProvider") || "manual_import");
  const captureKind = String(form.get("captureKind") || "room");
  const sourceJson = form.get("sourceJson");
  const model = form.get("model");

  if (!targetId || !label || !["project", "estimate"].includes(targetType)) {
    return NextResponse.json({ ok: false, error: "Project or estimate and scan label are required." }, { status: 400 });
  }
  if (!CAPTURE_PROVIDERS.has(captureProvider) || !CAPTURE_KINDS.has(captureKind)) {
    return NextResponse.json({ ok: false, error: "Unsupported capture provider or scan type." }, { status: 400 });
  }
  if (!(sourceJson instanceof File) && !(model instanceof File)) {
    return NextResponse.json({ ok: false, error: "Attach a RoomPlan JSON export, USDZ model, or both." }, { status: 400 });
  }
  if (sourceJson instanceof File && sourceJson.size > MAX_JSON_BYTES) {
    return NextResponse.json({ ok: false, error: "RoomPlan JSON must be 25 MB or smaller." }, { status: 400 });
  }
  if (model instanceof File && model.size > MAX_MODEL_BYTES) {
    return NextResponse.json({ ok: false, error: "USDZ model must be 500 MB or smaller." }, { status: 400 });
  }
  if (sourceJson instanceof File && !sourceJson.name.toLowerCase().endsWith(".json")) {
    return NextResponse.json({ ok: false, error: "The source scan must be a JSON export." }, { status: 400 });
  }
  if (model instanceof File && !model.name.toLowerCase().endsWith(".usdz")) {
    return NextResponse.json({ ok: false, error: "The 3D model must be a USDZ export." }, { status: 400 });
  }

  const targetTable = targetType === "project" ? "projects" : "estimates";
  const { data: target } = await supabase.from(targetTable).select("id").eq("id", targetId).eq("company_id", workspace.context.companyId).maybeSingle();
  if (!target) return NextResponse.json({ ok: false, error: "Target not found in this company." }, { status: 404 });

  const scanId = crypto.randomUUID();
  const prefix = `${workspace.context.companyId}/${targetType}/${targetId}/${scanId}`;
  let sourceJsonPath: string | null = null;
  let modelPath: string | null = null;
  const uploaded: string[] = [];

  try {
    if (sourceJson instanceof File) {
      sourceJsonPath = `${prefix}/${safeFileName(sourceJson.name, "roomplan.json")}`;
      const result = await supabase.storage.from(BUCKET).upload(sourceJsonPath, sourceJson, { contentType: "application/json", upsert: false });
      if (result.error) throw result.error;
      uploaded.push(sourceJsonPath);
    }
    if (model instanceof File) {
      modelPath = `${prefix}/${safeFileName(model.name, "room.usdz")}`;
      const result = await supabase.storage.from(BUCKET).upload(modelPath, model, { contentType: "model/vnd.usdz+zip", upsert: false });
      if (result.error) throw result.error;
      uploaded.push(modelPath);
    }

    let metadata: Record<string, unknown> = {};
    const metadataRaw = String(form.get("metadata") || "").trim();
    if (metadataRaw) {
      try {
        const parsed = JSON.parse(metadataRaw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
      } catch {
        return NextResponse.json({ ok: false, error: "Scan metadata must be valid JSON." }, { status: 400 });
      }
    }

    const payload = {
      id: scanId,
      company_id: workspace.context.companyId,
      project_id: targetType === "project" ? targetId : null,
      estimate_id: targetType === "estimate" ? targetId : null,
      label,
      capture_provider: captureProvider,
      capture_kind: captureKind,
      status: "ready",
      source_json_path: sourceJsonPath,
      model_path: modelPath,
      device_model: String(form.get("deviceModel") || "").trim() || null,
      operating_system: String(form.get("operatingSystem") || "").trim() || null,
      framework_version: String(form.get("frameworkVersion") || "").trim() || null,
      room_count: optionalNumber(form.get("roomCount")),
      floor_area_sqft: optionalNumber(form.get("floorAreaSqFt")),
      wall_area_sqft: optionalNumber(form.get("wallAreaSqFt")),
      opening_count: optionalNumber(form.get("openingCount")),
      object_count: optionalNumber(form.get("objectCount")),
      metadata,
      captured_at: String(form.get("capturedAt") || "").trim() || null,
      created_by: user.id,
    };

    const realityDb = supabase as unknown as UntypedSupabase;
    const insertQuery = realityDb.from("reality_scans").insert(payload) as ReturnType<typeof supabase.from>;
    const { data, error } = await insertQuery.select("id").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, scan: data }, { status: 201 });
  } catch (reason) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    const message = reason instanceof Error ? reason.message : "Could not save Reality Engine scan.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
