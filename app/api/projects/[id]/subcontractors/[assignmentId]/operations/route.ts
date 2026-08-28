/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const INTERNAL_ROLES = new Set(["owner", "administrator", "office_manager", "project_manager"]);

type Db = {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function context(projectId: string, assignmentId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  if (!INTERNAL_ROLES.has((workspace.context.role || "").toLowerCase())) throw new Error("You are not authorized to manage subcontractor financial operations.");
  const db = supabase as unknown as Db;
  const assignmentResult = await db.from("trade_partner_assignments")
    .select("id,company_id,project_id,vendor_id,trade_name,contract_status,contract_amount,payment_terms,retainage_percent,assignment_status,mobilization_status")
    .eq("company_id", workspace.context.companyId).eq("project_id", projectId).eq("id", assignmentId).maybeSingle();
  if (assignmentResult.error || !assignmentResult.data) throw new Error("Subcontractor assignment not found.");
  return { db, workspace: workspace.context, assignment: assignmentResult.data as Record<string, unknown> };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const { db, workspace, assignment } = await context(projectId, assignmentId);
    await db.rpc("ensure_subcontractor_closeout_requirements", { p_assignment_id: assignmentId });
    const [changeOrdersResult, paymentAppsResult, closeoutResult] = await Promise.all([
      db.from("subcontractor_change_orders").select("id,change_order_number,title,description,amount_delta,schedule_impact_days,status,submitted_at,approved_at,rejected_at,review_notes,created_at").eq("company_id", workspace.companyId).eq("assignment_id", assignmentId).order("created_at", { ascending: false }),
      db.from("subcontractor_payment_applications").select("id,request_number,period_through,description,amount_requested,retainage_amount,net_requested,status,vendor_bill_id,submitted_at,reviewed_at,review_notes,created_at").eq("company_id", workspace.companyId).eq("assignment_id", assignmentId).order("created_at", { ascending: false }),
      db.from("subcontractor_closeout_requirements").select("id,requirement_type,required,status,evidence,verified_at,created_at").eq("company_id", workspace.companyId).eq("assignment_id", assignmentId).order("created_at", { ascending: true }),
    ]);
    for (const result of [changeOrdersResult, paymentAppsResult, closeoutResult]) if (result.error) throw new Error(result.error.message);
    const paymentApps = (paymentAppsResult.data || []) as Array<Record<string, unknown>>;
    const billIds = paymentApps.map((row) => row.vendor_bill_id).filter((value): value is string => typeof value === "string");
    let bills: Array<Record<string, unknown>> = [];
    if (billIds.length) {
      const billResult = await db.from("vendor_bills").select("id,bill_number,status,total_amount,amount_paid,balance_due,retainage_amount,due_date").eq("company_id", workspace.companyId).in("id", billIds);
      if (billResult.error) throw new Error(billResult.error.message);
      bills = billResult.data || [];
    }
    const billById = new Map(bills.map((bill) => [String(bill.id), bill]));
    const changeOrders = (changeOrdersResult.data || []) as Array<Record<string, unknown>>;
    const approvedChange = changeOrders.filter((row) => row.status === "approved").reduce((sum, row) => sum + Number(row.amount_delta || 0), 0);
    const baseCommitment = Number(assignment.contract_amount || 0);
    const closeout = (closeoutResult.data || []) as Array<Record<string, unknown>>;
    const requiredOpen = closeout.filter((row) => row.required && !["verified", "waived"].includes(String(row.status))).length;
    const convertedBills = paymentApps.map((row) => typeof row.vendor_bill_id === "string" ? billById.get(row.vendor_bill_id) : null).filter(Boolean) as Array<Record<string, unknown>>;
    const paid = convertedBills.reduce((sum, bill) => sum + Number(bill.amount_paid || 0), 0);
    const outstanding = convertedBills.reduce((sum, bill) => sum + Number(bill.balance_due || 0), 0);

    return NextResponse.json({
      assignment,
      commitment: { base: baseCommitment, approvedChanges: approvedChange, total: baseCommitment + approvedChange },
      changeOrders,
      paymentApplications: paymentApps.map((row) => ({ ...row, bill: typeof row.vendor_bill_id === "string" ? billById.get(row.vendor_bill_id) || null : null })),
      closeoutRequirements: closeout,
      billing: { paid, outstanding, convertedBills: convertedBills.length },
      closeoutReady: requiredOpen === 0 && !paymentApps.some((row) => ["submitted", "approved"].includes(String(row.status))) && outstanding <= 0,
      requiredCloseoutOpen: requiredOpen,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load subcontractor operations." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const { db } = await context(projectId, assignmentId);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    let result: { data: unknown; error: { message: string } | null };
    if (action === "create_change_order") {
      result = await db.rpc("create_subcontractor_change_order", {
        p_assignment_id: assignmentId,
        p_title: String(body.title || ""),
        p_description: body.description ? String(body.description) : null,
        p_amount_delta: Number(body.amountDelta || 0),
        p_schedule_impact_days: Number(body.scheduleImpactDays || 0),
      });
    } else if (action === "review_change_order") {
      result = await db.rpc("review_subcontractor_change_order", { p_change_order_id: String(body.changeOrderId || ""), p_action: String(body.reviewAction || ""), p_review_notes: body.notes ? String(body.notes) : null });
    } else if (action === "review_payment_application") {
      result = await db.rpc("review_subcontractor_payment_application", { p_application_id: String(body.applicationId || ""), p_action: String(body.reviewAction || ""), p_review_notes: body.notes ? String(body.notes) : null });
    } else if (action === "update_closeout") {
      result = await db.rpc("update_subcontractor_closeout_requirement", { p_requirement_id: String(body.requirementId || ""), p_status: String(body.status || ""), p_evidence: body.evidence && typeof body.evidence === "object" ? body.evidence : {} });
    } else if (action === "close_assignment") {
      result = await db.rpc("close_subcontractor_assignment", { p_assignment_id: assignmentId });
    } else {
      return NextResponse.json({ error: "Unsupported subcontractor operation." }, { status: 400 });
    }
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ ok: true, result: result.data ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update subcontractor operations." }, { status: 400 });
  }
}
