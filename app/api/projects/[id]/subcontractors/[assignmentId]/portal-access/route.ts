import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import {
  createTradePartnerInviteToken,
  sendTradePartnerEmail,
} from "@/lib/trade-partners/invitations";

const INTERNAL_ROLES = new Set(["owner", "administrator", "office_manager", "project_manager"]);
const asText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;


async function loadPortalState(projectId: string, assignmentId: string) {
  const supabase = await createClient();
  if (!supabase) return { error: "B.O.S. database is unavailable.", status: 503 as const };

  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) return { error: workspace.errorMessage || "Unauthorized.", status: 401 as const };
  if (!INTERNAL_ROLES.has((workspace.context.role || "").toLowerCase())) {
    return { error: "You are not authorized to manage Trade Partner portal access.", status: 403 as const };
  }

  const admin = createAdminClient();
  const { data: assignment } = await admin
    .from("trade_partner_assignments")
    .select("vendor_id")
    .eq("company_id", workspace.context.companyId)
    .eq("project_id", projectId)
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment) return { error: "Trade Partner assignment not found.", status: 404 as const };

  const [{ data: activeMembership }, { data: pendingInvitation }] = await Promise.all([
    admin
      .from("company_memberships")
      .select("id")
      .eq("company_id", workspace.context.companyId)
      .eq("vendor_id" as never, assignment.vendor_id as never)
      .eq("role", "subcontractor")
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
    admin
      .from("trade_partner_invitations" as never)
      .select("id,status,expires_at")
      .eq("company_id", workspace.context.companyId)
      .eq("vendor_id", assignment.vendor_id)
      .in("status", ["sent", "opened", "claimed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    status: 200 as const,
    active: Boolean(activeMembership),
    pending: Boolean(pendingInvitation),
    invitationStatus: pendingInvitation ? String((pendingInvitation as { status?: string }).status || "sent") : null,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const { id: projectId, assignmentId } = await params;
  const state = await loadPortalState(projectId, assignmentId);
  if ("error" in state) return NextResponse.json({ error: state.error }, { status: state.status });
  return NextResponse.json({ active: state.active, pending: state.pending, invitationStatus: state.invitationStatus });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });

    const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
    if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });
    if (!INTERNAL_ROLES.has((workspace.context.role || "").toLowerCase())) {
      return NextResponse.json({ error: "You are not authorized to manage Trade Partner portal access." }, { status: 403 });
    }

    const companyId = workspace.context.companyId;
    const admin = createAdminClient();
    const { data: assignment } = await admin
      .from("trade_partner_assignments")
      .select("*")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .eq("id", assignmentId)
      .single();
    if (!assignment) return NextResponse.json({ error: "Trade Partner assignment not found." }, { status: 404 });

    const { data: vendor } = await admin
      .from("vendors")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", assignment.vendor_id)
      .single();
    if (!vendor) return NextResponse.json({ error: "Trade Partner record not found." }, { status: 404 });

    const email = asText(assignment.primary_contact_email) || asText(vendor.email);
    if (!email) return NextResponse.json({ error: "Add a Trade Partner email address before sending portal access." }, { status: 400 });

    const { data: activeMembership } = await admin
      .from("company_memberships")
      .select("id")
      .eq("company_id", companyId)
      .eq("vendor_id" as never, assignment.vendor_id as never)
      .eq("role", "subcontractor")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (activeMembership) {
      return NextResponse.json({ ok: true, alreadyActive: true, message: "This Trade Partner already has active B.O.S. portal access." });
    }

    await admin
      .from("trade_partner_invitations" as never)
      .update({ status: "cancelled", updated_at: new Date().toISOString() } as never)
      .eq("company_id", companyId)
      .eq("vendor_id", assignment.vendor_id)
      .in("status", ["sent", "opened", "claimed"]);

    const { token, tokenHash } = createTradePartnerInviteToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invitation, error: invitationError } = await admin
      .from("trade_partner_invitations" as never)
      .insert({
        company_id: companyId,
        vendor_id: assignment.vendor_id,
        token_hash: tokenHash,
        email,
        phone: asText(assignment.primary_contact_phone) || asText(vendor.phone) || null,
        first_name: asText(vendor.first_name),
        last_name: asText(vendor.last_name),
        status: "sent",
        delivery_channels: [],
        delivery_metadata: {},
        expires_at: expiresAt,
        created_by: workspace.context.userId,
      } as never)
      .select("id")
      .single();

    if (invitationError || !invitation) {
      throw new Error(invitationError?.message || "Unable to create Trade Partner portal invitation.");
    }

    const invitationId = String((invitation as { id: string }).id);
    const link = new URL("/trade-partner-invite", request.url);
    link.searchParams.set("token", token);
    const recipientName = asText(assignment.primary_contact_name)
      || [asText(vendor.first_name), asText(vendor.last_name)].filter(Boolean).join(" ");
    const companyName = "Bango Construction";

    await sendTradePartnerEmail({
      email,
      link: link.toString(),
      recipientName,
      companyName,
      stage: "intake",
      idempotencyKey: `bos-trade-partner-portal-access-${invitationId}`,
    });

    await admin
      .from("trade_partner_invitations" as never)
      .update({
        delivery_channels: ["email"],
        delivery_metadata: { source: "manual_portal_access", email: "sent" },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", invitationId);

    return NextResponse.json({
      ok: true,
      sent: true,
      email,
      expiresAt,
      message: "Secure Trade Partner portal setup email sent.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send Trade Partner portal access." }, { status: 400 });
  }
}
