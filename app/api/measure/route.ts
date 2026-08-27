import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const BUCKET = "bos-measurements";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok:false, error:"Workspace unavailable." }, { status:503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ ok:false, error:workspace.errorMessage || "Unauthorized." }, { status:401 });
  const url = new URL(req.url);
  const targetType = url.searchParams.get("targetType");
  const targetId = url.searchParams.get("targetId");
  if (!targetId || !["project","estimate"].includes(targetType || "")) {
    const [projects, estimates] = await Promise.all([
      supabase.from("projects").select("id,name,project_number").eq("company_id", workspace.context.companyId).order("updated_at", { ascending:false }).limit(100),
      supabase.from("estimates").select("id,title,estimate_number,status").eq("company_id", workspace.context.companyId).order("updated_at", { ascending:false }).limit(100),
    ]);
    return NextResponse.json({ ok:true, projects:projects.data || [], estimates:estimates.data || [] });
  }
  const column = targetType === "project" ? "project_id" : "estimate_id";
  // Generated Supabase types are refreshed after the Production migration lands.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("measurements").select("id,label,measurement_type,value_inches,method,confidence,photo_path,notes,created_at").eq("company_id", workspace.context.companyId).eq(column, targetId).order("created_at", { ascending:false });
  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  return NextResponse.json({ ok:true, measurements:data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok:false, error:"Workspace unavailable." }, { status:503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ ok:false, error:workspace.errorMessage || "Unauthorized." }, { status:401 });
  const { data:userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ ok:false, error:"Unauthorized." }, { status:401 });

  const form = await req.formData();
  const targetType = String(form.get("targetType") || "");
  const targetId = String(form.get("targetId") || "");
  const label = String(form.get("label") || "").trim();
  const measurementType = String(form.get("measurementType") || "length");
  const valueInches = Number(form.get("valueInches"));
  const referenceInches = Number(form.get("referenceInches")) || null;
  const notes = String(form.get("notes") || "").trim() || null;
  const photo = form.get("photo");
  if (!targetId || !label || !Number.isFinite(valueInches) || valueInches <= 0 || !["project","estimate"].includes(targetType)) {
    return NextResponse.json({ ok:false, error:"Target, label, and a verified measurement are required." }, { status:400 });
  }
  const targetTable = targetType === "project" ? "projects" : "estimates";
  const { data:target } = await supabase.from(targetTable).select("id").eq("id", targetId).eq("company_id", workspace.context.companyId).maybeSingle();
  if (!target) return NextResponse.json({ ok:false, error:"Target not found in this company." }, { status:404 });

  let photoPath:string|null = null;
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 10 * 1024 * 1024 || !photo.type.startsWith("image/")) return NextResponse.json({ ok:false, error:"Photo must be an image under 10 MB." }, { status:400 });
    const ext = (photo.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
    photoPath = `${workspace.context.companyId}/${targetType}/${targetId}/${crypto.randomUUID()}.${ext}`;
    const { error:uploadError } = await supabase.storage.from(BUCKET).upload(photoPath, photo, { contentType:photo.type, upsert:false });
    if (uploadError) return NextResponse.json({ ok:false, error:uploadError.message }, { status:500 });
  }

  const payload = {
    company_id: workspace.context.companyId,
    project_id: targetType === "project" ? targetId : null,
    estimate_id: targetType === "estimate" ? targetId : null,
    label,
    measurement_type: measurementType,
    value_inches: valueInches,
    method: photoPath ? "camera_reference" : "manual",
    reference_inches: referenceInches,
    confidence: "user_verified",
    photo_path: photoPath,
    notes,
    created_by: user.id,
  };
  // Generated Supabase types are refreshed after the Production migration lands.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("measurements").insert(payload).select("id").single();
  if (error) {
    if (photoPath) await supabase.storage.from(BUCKET).remove([photoPath]);
    return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  }
  return NextResponse.json({ ok:true, measurement:data }, { status:201 });
}
