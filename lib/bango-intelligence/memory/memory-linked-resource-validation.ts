import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MemoryCreateInput } from "./memory-types";

type ValidationResult = { ok: true } | { ok: false; error: string };

export async function validateLinkedResourcesForMemoryCreate(
  supabase: SupabaseClient<Database>,
  companyId: string,
  input: MemoryCreateInput,
): Promise<ValidationResult> {
  if (input.projectId) {
    const project = await supabase
      .from("projects")
      .select("id")
      .eq("id", input.projectId)
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (project.error || !project.data) {
      return { ok: false, error: "Invalid project link for this company." };
    }
  }

  if (input.customerId) {
    const customer = await supabase
      .from("customers")
      .select("id")
      .eq("id", input.customerId)
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (customer.error || !customer.data) {
      return { ok: false, error: "Invalid customer link for this company." };
    }
  }

  if (input.taskId) {
    const task = await supabase
      .from("tasks")
      .select("id, project_id")
      .eq("id", input.taskId)
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (task.error || !task.data) {
      return { ok: false, error: "Invalid task link for this company." };
    }

    if (input.projectId && task.data.project_id !== input.projectId) {
      return { ok: false, error: "taskId project must match projectId." };
    }
  }

  if (input.phaseId) {
    const phase = await supabase
      .from("project_phases")
      .select("id, project_id")
      .eq("id", input.phaseId)
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (phase.error || !phase.data) {
      return { ok: false, error: "Invalid phase link for this company." };
    }

    if (input.projectId && phase.data.project_id !== input.projectId) {
      return { ok: false, error: "phaseId project must match projectId." };
    }
  }

  return { ok: true };
}
