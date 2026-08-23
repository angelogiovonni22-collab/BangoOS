import { NextRequest, NextResponse } from "next/server";
import { PLATFORM_PLAN_OPTIONS, PLATFORM_STATUS_OPTIONS, type PlatformPlan, type PlatformTenantStatus } from "@/lib/platform-admin/types";
import { createClient } from "@/lib/supabase/server";

type UpdatePayload = { planKey?: PlatformPlan; lifecycleStatus?: PlatformTenantStatus; seatLimit?: number; orionTextAllowance?: number; orionVoiceMinutes?: number; internalNotes?: string | null };

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ ok: false, error: "B.O.S. is unavailable." }, { status: 503 });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Authentication is required." }, { status: 401 });
    const { data: administrator } = await supabase.from("bos_platform_admins").select("user_id").eq("user_id", user.id).eq("active", true).maybeSingle();
    if (!administrator) return NextResponse.json({ ok: false, error: "Platform administrator access is required." }, { status: 403 });
    const payload = await request.json() as UpdatePayload;
    if (payload.planKey && !PLATFORM_PLAN_OPTIONS.includes(payload.planKey)) return NextResponse.json({ ok: false, error: "Choose a valid plan." }, { status: 400 });
    if (payload.lifecycleStatus && !PLATFORM_STATUS_OPTIONS.includes(payload.lifecycleStatus)) return NextResponse.json({ ok: false, error: "Choose a valid account status." }, { status: 400 });
    for (const [label, value] of [["Seat limit", payload.seatLimit], ["Orion text allowance", payload.orionTextAllowance], ["Orion voice minutes", payload.orionVoiceMinutes]] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < (label === "Seat limit" ? 1 : 0))) return NextResponse.json({ ok: false, error: `${label} is invalid.` }, { status: 400 });
    }
    const { companyId } = await params;
    const update = {
      ...(payload.planKey ? { plan_key: payload.planKey } : {}), ...(payload.lifecycleStatus ? { lifecycle_status: payload.lifecycleStatus } : {}),
      ...(payload.seatLimit !== undefined ? { seat_limit: payload.seatLimit } : {}), ...(payload.orionTextAllowance !== undefined ? { orion_text_allowance: payload.orionTextAllowance } : {}),
      ...(payload.orionVoiceMinutes !== undefined ? { orion_voice_minutes: payload.orionVoiceMinutes } : {}), ...(payload.internalNotes !== undefined ? { internal_notes: payload.internalNotes?.trim() || null } : {}), updated_at: new Date().toISOString(),
    };
    const { data: account, error } = await supabase.from("bos_tenant_accounts").update(update).eq("company_id", companyId).select("company_id, plan_key, lifecycle_status, seat_limit, orion_text_allowance, orion_voice_minutes, support_tier, trial_ends_at, internal_notes, created_at, updated_at").single();
    if (error) throw error;
    const [{ data: company }, { count: memberCount }, { count: projectCount }] = await Promise.all([
      supabase.from("companies").select("id, name, slug, created_at").eq("id", companyId).single(),
      supabase.from("company_memberships").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    ]);
    if (!company) throw new Error("Company not found.");
    const audit = await supabase.from("bos_platform_audit_log").insert({ actor_user_id: user.id, company_id: companyId, action: "tenant_account.updated", changes: update });
    if (audit.error) throw audit.error;
    return NextResponse.json({ ok: true, tenant: { companyId, companyName: company.name, slug: company.slug, planKey: account.plan_key, lifecycleStatus: account.lifecycle_status, seatLimit: account.seat_limit, memberCount: memberCount || 0, projectCount: projectCount || 0, orionTextAllowance: account.orion_text_allowance, orionVoiceMinutes: account.orion_voice_minutes, supportTier: account.support_tier, trialEndsAt: account.trial_ends_at, internalNotes: account.internal_notes, createdAt: account.created_at, updatedAt: account.updated_at } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update this company." }, { status: 500 });
  }
}
