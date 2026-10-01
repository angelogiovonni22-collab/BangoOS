import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const STATUS_ROLES = new Set(["owner", "administrator", "operations_manager", "project_manager", "superintendent"]);
const ALLOWED_STATUSES = new Set(["in_progress", "on_hold", "delayed"]);

const STATUS_LABELS: Record<string, string> = {
  in_progress: "Active",
  on_hold: "Paused",
  delayed: "Delayed",
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json().catch(() => ({})) as { status?: unknown; reason?: unknown };
    const nextStatus = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

    if (!ALLOWED_STATUSES.has(nextStatus)) {
      return NextResponse.json({ error: "Choose Active, Paused, or Delayed from the Project Status control." }, { status: 400 });
    }
    if ((nextStatus === "on_hold" || nextStatus === "delayed") && !reason) {
      return NextResponse.json({ error: "A reason is required when a project is paused or delayed." }, { status: 400 });
    }

    const supabase = await createClient();
    if (!supabase) throw new Error("B.O.S. database is unavailable.");
    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
    const role = (workspace.context.role || "").toLowerCase();
    if (!STATUS_ROLES.has(role)) throw new Error("You are not authorized to change project status.");

    // Supabase generated types can lag operational project-status migrations.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as { from: (table: string) => any };
    const existing = await db.from("projects")
      .select("id,name,status")
      .eq("company_id", workspace.context.companyId)
      .eq("id", projectId)
      .maybeSingle();

    if (existing.error || !existing.data) throw new Error("Project not found.");
    if (existing.data.status === "completed" || existing.data.status === "cancelled") {
      throw new Error("Completed or cancelled projects cannot be returned to an active status from this control.");
    }

    if (existing.data.status === nextStatus) {
      return NextResponse.json({
        ok: true,
        unchanged: true,
        project: existing.data,
        notifiedTradePartners: 0,
        message: `Project is already ${STATUS_LABELS[nextStatus].toLowerCase()}.`,
      });
    }

    const now = new Date().toISOString();
    const update = await db.from("projects")
      .update({ status: nextStatus, updated_at: now })
      .eq("company_id", workspace.context.companyId)
      .eq("id", projectId)
      .select("id,name,status")
      .single();
    if (update.error || !update.data) throw new Error(update.error?.message || "Unable to update project status.");

    const assignments = await db.from("trade_partner_assignments")
      .select("vendor_id,trade_name")
      .eq("company_id", workspace.context.companyId)
      .eq("project_id", projectId)
      .eq("assignment_status", "active")
      .eq("contract_status", "signed");

    let notifiedTradePartners = 0;
    if (!assignments.error && assignments.data?.length) {
      const vendorIds = Array.from(new Set(
        assignments.data.map((row: { vendor_id: string | null }) => row.vendor_id).filter(Boolean),
      )) as string[];

      if (vendorIds.length) {
        const memberships = await db.from("company_memberships")
          .select("user_id,vendor_id")
          .eq("company_id", workspace.context.companyId)
          .eq("status", "active")
          .eq("role", "subcontractor")
          .in("vendor_id", vendorIds);

        if (!memberships.error && memberships.data?.length) {
          const title = `Project status: ${STATUS_LABELS[nextStatus]}`;
          const reasonText = reason ? ` Reason: ${reason}` : "";
          const message = `${existing.data.name} is now ${STATUS_LABELS[nextStatus].toLowerCase()}.${reasonText}`;
          const notificationRows = memberships.data.map((membership: { user_id: string; vendor_id: string }) => ({
            company_id: workspace.context!.companyId,
            recipient_user_id: membership.user_id,
            actor_user_id: workspace.context!.userId,
            category: "schedule",
            severity: nextStatus === "in_progress" ? "success" : "warning",
            title,
            message,
            entity_type: "project",
            entity_id: projectId,
            linked_href: `/partner/${projectId}`,
            source_module: "project_status",
            source_key: `project-status:${projectId}:${nextStatus}:${now}:${membership.vendor_id}`,
            requested_channels: ["in_app"],
            delivery_state: "ready",
            push_status: "not_requested",
            email_status: "not_requested",
          }));

          const notificationInsert = await db.from("bos_notifications").insert(notificationRows);
          if (notificationInsert.error) {
            throw new Error(`Project status changed, but Trade Partner alerts could not be created: ${notificationInsert.error.message}`);
          }
          notifiedTradePartners = notificationRows.length;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      project: update.data,
      notifiedTradePartners,
      message: `Project status changed to ${STATUS_LABELS[nextStatus]}.${notifiedTradePartners ? ` ${notifiedTradePartners} Trade Partner alert${notifiedTradePartners === 1 ? "" : "s"} sent.` : ""}`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update project status." }, { status: 400 });
  }
}
