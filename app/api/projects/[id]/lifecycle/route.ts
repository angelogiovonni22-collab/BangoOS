import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

async function getProjectContext(id: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");

  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");

  const { data: project, error } = await supabase
    .from("projects")
    .select("id,name,status")
    .eq("company_id", workspace.context.companyId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to load project.");
  if (!project) throw new Error("Project not found.");

  return { supabase, project };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as { action?: "delete" | "restore" };
    if (body.action !== "delete" && body.action !== "restore") {
      return NextResponse.json({ error: "Invalid project lifecycle action." }, { status: 400 });
    }

    const { supabase } = await getProjectContext(id);

    if (body.action === "delete") {
      const { data, error } = await supabase.rpc("soft_delete_project" as never, { p_project_id: id } as never) as {
        data: Array<{ history_id: string; deleted_at: string }> | null;
        error: { message: string } | null;
      };
      if (error) throw new Error(error.message || "Unable to delete project.");
      return NextResponse.json({ deleted: true, ...(data?.[0] || {}) });
    }

    const { data, error } = await supabase.rpc("restore_deleted_project" as never, { p_project_id: id } as never) as {
      data: Array<{ history_id: string; restored_status: string; restored_at: string }> | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message || "Unable to restore project.");
    return NextResponse.json({ restored: true, ...(data?.[0] || {}) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update project." }, { status: 400 });
  }
}
