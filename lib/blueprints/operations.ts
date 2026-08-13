import type { SupabaseClient } from "@supabase/supabase-js";

export type BlueprintOperationalLink = {
  annotationId: string;
  targetType: "task" | "estimate_line_item" | "change_order" | "rfi" | "punch_item" | "workforce_assignment";
  targetId: string;
};

export type BlueprintProjectEstimate = { id: string; label: string; status: string };
export type BlueprintWorkforceOption = { id: string; type: "employee" | "crew"; label: string };
export type BlueprintProjectImpactSummary = { openIssues: number; unlinkedIssues: number; tasks: number; punchItems: number; changeOrders: number; workforceAssignments: number; estimateItems: number };

function operationalLinks(supabase: SupabaseClient) {
  return (supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_operational_links");
}

export async function loadBlueprintProjectImpactSummary(supabase: SupabaseClient, input: { companyId: string; projectId: string }): Promise<BlueprintProjectImpactSummary> {
  const annotations = (supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_annotations");
  const [issuesResponse, linksResponse] = await Promise.all([
    annotations.select("id").eq("company_id", input.companyId).eq("project_id", input.projectId).eq("annotation_type", "pin").eq("status", "open"),
    operationalLinks(supabase).select("annotation_id, target_type").eq("company_id", input.companyId).eq("project_id", input.projectId),
  ]);
  if (issuesResponse.error) throw issuesResponse.error;
  if (linksResponse.error) throw linksResponse.error;
  const openIssueIds = new Set(((issuesResponse.data ?? []) as Array<{ id: string }>).map((row) => row.id));
  const links = (linksResponse.data ?? []) as Array<{ annotation_id: string; target_type: BlueprintOperationalLink["targetType"] }>;
  const linkedOpenIssueIds = new Set(links.filter((link) => openIssueIds.has(link.annotation_id)).map((link) => link.annotation_id));
  const count = (type: BlueprintOperationalLink["targetType"]) => links.filter((link) => link.target_type === type).length;
  return { openIssues: openIssueIds.size, unlinkedIssues: openIssueIds.size - linkedOpenIssueIds.size, tasks: count("task"), punchItems: count("punch_item"), changeOrders: count("change_order"), workforceAssignments: count("workforce_assignment"), estimateItems: count("estimate_line_item") };
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

export async function createChangeOrderFromBlueprintIssue(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string }) {
  const response = await (supabase as unknown as {
    rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("create_change_order_from_blueprint_issue", {
    p_company_id: input.companyId,
    p_project_id: input.projectId,
    p_blueprint_version_id: input.versionId,
    p_annotation_id: input.annotationId,
  });
  if (response.error) throw new Error(response.error.message);
  return String(response.data);
}

export async function loadBlueprintWorkforceOptions(supabase: SupabaseClient, companyId: string) {
  const from = (table: string) => (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient["from"]> }).from(table);
  const [employees, crews] = await Promise.all([
    from("employees").select("id, employee_number, position_title").eq("company_id", companyId).eq("employment_status", "active").order("employee_number"),
    from("crews").select("id, crew_code, name").eq("company_id", companyId).eq("status", "active").order("name"),
  ]);
  if (employees.error) throw employees.error;
  if (crews.error) throw crews.error;
  return [
    ...((employees.data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), type: "employee" as const, label: `${String(row.employee_number)} · ${String(row.position_title)}` })),
    ...((crews.data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), type: "crew" as const, label: `${String(row.crew_code)} · ${String(row.name)}` })),
  ] satisfies BlueprintWorkforceOption[];
}

export async function assignBlueprintIssueToWorkforce(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string; assignmentType: "employee" | "crew"; assigneeId: string }) {
  const response = await (supabase as unknown as { rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("assign_blueprint_issue_to_workforce", {
    p_company_id: input.companyId, p_project_id: input.projectId,
    p_blueprint_version_id: input.versionId, p_annotation_id: input.annotationId,
    p_assignment_type: input.assignmentType, p_assignee_id: input.assigneeId,
  });
  if (response.error) throw new Error(response.error.message);
  return String(response.data);
}

export async function createPunchItemFromBlueprintIssue(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string }) {
  const response = await (supabase as unknown as { rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("create_punch_item_from_blueprint_issue", {
    p_company_id: input.companyId,
    p_project_id: input.projectId,
    p_blueprint_version_id: input.versionId,
    p_annotation_id: input.annotationId,
  });
  if (response.error) throw new Error(response.error.message);
  return String(response.data);
}
