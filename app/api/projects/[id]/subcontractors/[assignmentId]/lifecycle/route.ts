/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const INTERNAL_ROLES = new Set(["owner", "administrator", "operations_manager", "office_manager", "project_manager", "superintendent"]);
const DELETE_ROLES = new Set(["owner", "administrator"]);

type Db = {
  from: (table: string) => any;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function context(projectId: string, assignmentId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  const role = (workspace.context.role || "").toLowerCase();
  if (!INTERNAL_ROLES.has(role)) throw new Error("You are not authorized to manage Trade Partner assignments.");

  const db = supabase as unknown as Db;
  const result = await db.from("trade_partner_assignments")
    .select("id,company_id,project_id,vendor_id,trade_name,assignment_status,contract_status,lifecycle_status,lifecycle_reason,lifecycle_ended_at,replaced_by_assignment_id")
    .eq("company_id", workspace.context.companyId)
    .eq("project_id", projectId)
    .eq("id", assignmentId)
    .maybeSingle();
  if (result.error || !result.data) throw new Error("Trade Partner assignment not found.");
  return { db, workspace: workspace.context, role, assignment: result.data as Record<string, unknown> };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const { db, assignment } = await context(projectId, assignmentId);
    const vendorId = String(assignment.vendor_id || "");
    const companyId = String(assignment.company_id || "");
    const [reviewResult, vendorResult] = await Promise.all([
      db.from("trade_partner_performance_reviews")
        .select("id,quality,schedule_reliability,communication,safety_compliance,professionalism,overall_rating,comments,reviewed_at")
        .eq("company_id", companyId).eq("assignment_id", assignmentId).maybeSingle(),
      db.from("vendors")
        .select("id,performance_rating,performance_review_count,rehire_status")
        .eq("company_id", companyId).eq("id", vendorId).maybeSingle(),
    ]);
    if (reviewResult.error) throw new Error(reviewResult.error.message);
    if (vendorResult.error) throw new Error(vendorResult.error.message);
    return NextResponse.json({ assignment, review: reviewResult.data || null, vendorPerformance: vendorResult.data || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Trade Partner lifecycle." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const { db, role } = await context(projectId, assignmentId);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "").trim().toLowerCase();

    if (["end", "remove", "terminate", "replace"].includes(action)) {
      const result = await db.rpc("manage_trade_partner_assignment_lifecycle", {
        p_assignment_id: assignmentId,
        p_action: action,
        p_reason: body.reason ? String(body.reason) : null,
        p_replacement_assignment_id: body.replacementAssignmentId ? String(body.replacementAssignmentId) : null,
        p_rehire_status: body.rehireStatus ? String(body.rehireStatus) : null,
      });
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ ok: true, result: result.data ?? null });
    }

    if (action === "rate") {
      const scores = ["quality", "scheduleReliability", "communication", "safetyCompliance", "professionalism"]
        .map((key) => Number(body[key]));
      if (scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) {
        return NextResponse.json({ error: "All five Trade Partner ratings must be whole numbers from 1 to 5." }, { status: 400 });
      }
      const result = await db.rpc("submit_trade_partner_performance_review", {
        p_assignment_id: assignmentId,
        p_quality: scores[0],
        p_schedule_reliability: scores[1],
        p_communication: scores[2],
        p_safety_compliance: scores[3],
        p_professionalism: scores[4],
        p_comments: body.comments ? String(body.comments) : null,
      });
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ ok: true, reviewId: result.data ?? null });
    }

    if (action === "delete_mistake") {
      if (!DELETE_ROLES.has(role)) return NextResponse.json({ error: "Only an owner or administrator can delete a mistaken assignment." }, { status: 403 });
      const result = await db.rpc("delete_mistaken_trade_partner_assignment", { p_assignment_id: assignmentId });
      if (result.error) throw new Error(result.error.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported Trade Partner lifecycle action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update Trade Partner lifecycle." }, { status: 400 });
  }
}
