import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { type AdaptiveBosCompanyProfile } from "@/lib/adaptive-bos/config";
import { resolveAdaptiveBosConfigFromDatabase } from "@/lib/adaptive-bos/server";

// Adaptive B.O.S. tables are migration-backed until generated database types are refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

function toAdaptiveProfile(data: Record<string, any> | null): AdaptiveBosCompanyProfile {
  return data ? {
    industryKey:data.industry_key,
    industryLabel:data.industry_label,
    businessModel:data.business_model,
    primaryServices:data.primary_services,
    moduleOverrides:data.module_overrides,
    terminologyOverrides:data.terminology_overrides,
    workflowOverrides:data.workflow_overrides,
  } : { industryKey:"construction", industryLabel:"Construction" };
}

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok:false, error:"Workspace unavailable." }, { status:503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ ok:false, error:workspace.errorMessage || "Unauthorized." }, { status:401 });
  const db = supabase as unknown as AnySupabase;
  const { data, error } = await db.from("company_operating_profiles")
    .select("industry_key,industry_label,business_model,primary_services,module_overrides,terminology_overrides,workflow_overrides,config_version")
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:500 });
  const resolved = await resolveAdaptiveBosConfigFromDatabase(supabase, toAdaptiveProfile(data));
  return NextResponse.json({ ok:true, profile:data, resolved });
}

export async function PATCH(req:Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ ok:false, error:"Workspace unavailable." }, { status:503 });
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) return NextResponse.json({ ok:false, error:workspace.errorMessage || "Unauthorized." }, { status:401 });
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok:false, error:"Unauthorized." }, { status:401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok:false, error:"A JSON payload is required." }, { status:400 });
  const allowed = new Set(["industry_key","industry_label","business_model","primary_services","workforce_model","customer_model","inventory_model","compliance_profile","module_overrides","terminology_overrides","workflow_overrides","discovery_answers"]);
  const payload:Record<string, unknown> = { company_id:workspace.context.companyId, updated_by:user.id };
  for (const [key, value] of Object.entries(body)) if (allowed.has(key)) payload[key] = value;
  if (!Object.keys(payload).some((key) => allowed.has(key))) return NextResponse.json({ ok:false, error:"No supported profile fields were supplied." }, { status:400 });
  const db = supabase as unknown as AnySupabase;
  const { data:existing } = await db.from("company_operating_profiles").select("company_id").eq("company_id", workspace.context.companyId).maybeSingle();
  let query;
  if (existing) query = db.from("company_operating_profiles").update(payload).eq("company_id", workspace.context.companyId);
  else query = db.from("company_operating_profiles").insert({ ...payload, created_by:user.id });
  const { data, error } = await query.select("industry_key,industry_label,business_model,primary_services,module_overrides,terminology_overrides,workflow_overrides,config_version").single();
  if (error) return NextResponse.json({ ok:false, error:error.message }, { status:400 });
  const resolved = await resolveAdaptiveBosConfigFromDatabase(supabase, toAdaptiveProfile(data));
  return NextResponse.json({ ok:true, profile:data, resolved });
}
