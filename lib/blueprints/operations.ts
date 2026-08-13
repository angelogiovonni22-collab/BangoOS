import type { SupabaseClient } from "@supabase/supabase-js";

export type BlueprintOperationalLink = {
  annotationId: string;
  targetType: "task" | "estimate_line_item" | "change_order" | "rfi" | "punch_item";
  targetId: string;
};

export type BlueprintProjectEstimate = { id: string; label: string; status: string };

function operationalLinks(supabase: SupabaseClient) {
  return (supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_operational_links");
}

export async function loadBlueprintOperationalLinks(supabase: SupabaseClient, identity: { companyId: string; projectId: string; versionId: string }) {
  const response = await operationalLinks(supabase)
    .select("annotation_id, target_type, target_id")
    .eq("company_id", identity.companyId)
    .eq("project_id", identity.projectId)
    .eq("blueprint_version_id", identity.versionId);
  if (response.error) throw response.error;
  return ((response.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    annotationId: String(row.annotation_id),
    targetType: String(row.target_type) as BlueprintOperationalLink["targetType"],
    targetId: String(row.target_id),
  } satisfies BlueprintOperationalLink));
}

export async function createTaskFromBlueprintIssue(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string }) {
  const response = await (supabase as unknown as {
    rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("create_task_from_blueprint_issue", {
    p_company_id: input.companyId,
    p_project_id: input.projectId,
    p_blueprint_version_id: input.versionId,
    p_annotation_id: input.annotationId,
  });
  if (response.error) throw new Error(response.error.message);
  return String(response.data);
}

export async function loadBlueprintProjectEstimates(supabase: SupabaseClient, input: { companyId: string; projectId: string }) {
  const response = await (supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> }).from("estimates")
    .select("id, estimate_number, title, status")
    .eq("company_id", input.companyId)
    .eq("project_id", input.projectId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (response.error) throw response.error;
  return ((response.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    label: `${String(row.estimate_number)} · ${String(row.title)}`,
    status: String(row.status),
  } satisfies BlueprintProjectEstimate));
}

export async function createEstimateLineItemFromBlueprintTakeoff(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string; estimateId: string }) {
  const response = await (supabase as unknown as {
    rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("create_estimate_line_item_from_blueprint_takeoff", {
    p_company_id: input.companyId,
    p_project_id: input.projectId,
    p_blueprint_version_id: input.versionId,
    p_annotation_id: input.annotationId,
    p_estimate_id: input.estimateId,
  });
  if (response.error) throw new Error(response.error.message);
  return String(response.data);
}
