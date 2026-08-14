import type { SupabaseClient } from "@supabase/supabase-js";

type Identity = { companyId: string; projectId: string; versionId: string; annotationId: string };
export type BlueprintIssuePriority = "low" | "medium" | "high" | "critical";

export async function setBlueprintIssueSla(supabase: SupabaseClient, input: Identity & { priority: BlueprintIssuePriority; dueAt: string | null }) {
  const response = await (supabase as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }> }).rpc("set_blueprint_issue_sla", {
    p_company_id: input.companyId, p_project_id: input.projectId, p_blueprint_version_id: input.versionId,
    p_annotation_id: input.annotationId, p_priority: input.priority, p_due_at: input.dueAt,
  });
  if (response.error) throw new Error(response.error.message);
}

export async function evaluateBlueprintIssueSlas(supabase: SupabaseClient, input: { companyId: string; projectId: string }) {
  const response = await (supabase as unknown as { rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("evaluate_blueprint_issue_slas", { p_company_id: input.companyId, p_project_id: input.projectId });
  if (response.error) throw new Error(response.error.message);
  return Number(response.data ?? 0);
}
