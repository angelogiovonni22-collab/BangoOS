/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createProjectExecutionService } from "@/lib/projects/execution";
import { ensureProjectCompletionInvoice } from "@/lib/invoices/service";

const COMPLETION_ROLES = new Set(["owner", "administrator", "operations_manager", "project_manager", "superintendent"]);

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();
    if (!supabase) throw new Error("B.O.S. database is unavailable.");
    const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
    if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
    const role = (workspace.context.role || "").toLowerCase();
    if (!COMPLETION_ROLES.has(role)) throw new Error("You are not authorized to complete projects.");

    const db = supabase as unknown as { from: (table: string) => any };
    const existing = await db.from("projects")
      .select("id,status,name")
      .eq("company_id", workspace.context.companyId)
      .eq("id", projectId)
      .maybeSingle();
    if (existing.error || !existing.data) throw new Error("Project not found.");
    if (existing.data.status === "completed") return NextResponse.json({ ok: true, alreadyCompleted: true });
    if (existing.data.status === "cancelled") throw new Error("A cancelled project cannot be marked complete.");

    const now = new Date().toISOString();
    const result = await db.from("projects")
      .update({ status: "completed", actual_end_date: now.slice(0, 10), updated_at: now })
      .eq("company_id", workspace.context.companyId)
      .eq("id", projectId)
      .select("id,status,actual_end_date")
      .single();
    if (result.error || !result.data) throw new Error(result.error?.message || "Unable to complete project.");

    const executionService = createProjectExecutionService(supabase as SupabaseClient<Database>);
    await executionService.startCloseout({
      companyId: workspace.context.companyId,
      actorProfileId: workspace.context.userId,
      idempotencyKey: `project-complete:${projectId}`,
      projectId,
      notes: "Closeout initialized automatically when project was marked completed.",
    });

    const completionInvoice = await ensureProjectCompletionInvoice({
      supabase: supabase as SupabaseClient<Database>,
      companyId: workspace.context.companyId,
      projectId,
      userId: workspace.context.userId,
    });
    if (completionInvoice.error) throw new Error(completionInvoice.error);

    return NextResponse.json({
      ok: true,
      project: result.data,
      completionInvoice,
      message: "Project completed. Closeout was initialized and the final invoice was prepared as a draft ready for review.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete project." }, { status: 400 });
  }
}
