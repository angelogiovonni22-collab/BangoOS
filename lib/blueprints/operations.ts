import type { SupabaseClient } from "@supabase/supabase-js";

export type BlueprintOperationalLink = {
  annotationId: string;
  targetType: "task" | "estimate_line_item" | "change_order" | "rfi" | "punch_item" | "workforce_assignment" | "submittal" | "material_request";
  targetId: string;
};

export type BlueprintProjectEstimate = { id: string; label: string; status: string };
export type BlueprintWorkforceOption = { id: string; type: "employee" | "crew"; label: string };
export type BlueprintProjectImpactSummary = { openIssues: number; unlinkedIssues: number; tasks: number; punchItems: number; changeOrders: number; workforceAssignments: number; estimateItems: number; changeOrderValue: number; estimateValue: number };
export type BlueprintOperationalSource = { projectId: string; versionId: string; annotationId: string; pageNumber: number };

function operationalLinks(supabase: SupabaseClient) {
  return (supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_operational_links");
}

export async function loadBlueprintSourcesForOperationalRecords(supabase: SupabaseClient, input: { targetType: BlueprintOperationalLink["targetType"]; targetIds: string[] }): Promise<BlueprintOperationalSource[]> {
  if (!input.targetIds.length) return [];
  const links = await operationalLinks(supabase).select("project_id, blueprint_version_id, annotation_id, target_id, created_at").eq("target_type", input.targetType).in("target_id", input.targetIds).order("created_at", { ascending: false });
  if (links.error) throw links.error;
  const rows = (links.data ?? []) as Array<Record<string, unknown>>;
  const annotationIds = [...new Set(rows.map((row) => String(row.annotation_id)))];
  if (!annotationIds.length) return [];
  const annotations = await (supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_annotations").select("id, geometry").in("id", annotationIds);
  if (annotations.error) throw annotations.error;
  const geometryById = new Map(((annotations.data ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row.geometry as Record<string, unknown>]));
  return rows.map((row) => {
    const geometry = geometryById.get(String(row.annotation_id));
    return { projectId: String(row.project_id), versionId: String(row.blueprint_version_id), annotationId: String(row.annotation_id), pageNumber: Math.max(1, Number(geometry?.page ?? 1)) };
  });
}

export async function loadBlueprintProjectImpactSummary(supabase: SupabaseClient, input: { companyId: string; projectId: string }): Promise<BlueprintProjectImpactSummary> {
  const annotations = (supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_annotations");
  const [issuesResponse, linksResponse] = await Promise.all([
    annotations.select("id").eq("company_id", input.companyId).eq("project_id", input.projectId).eq("annotation_type", "pin").eq("status", "open"),
    operationalLinks(supabase).select("annotation_id, target_type, target_id").eq("company_id", input.companyId).eq("project_id", input.projectId),
  ]);
  if (issuesResponse.error) throw issuesResponse.error;
  if (linksResponse.error) throw linksResponse.error;
  const openIssueIds = new Set(((issuesResponse.data ?? []) as Array<{ id: string }>).map((row) => row.id));
  const links = (linksResponse.data ?? []) as Array<{ annotation_id: string; target_type: BlueprintOperationalLink["targetType"]; target_id: string }>;
  const linkedOpenIssueIds = new Set(links.filter((link) => openIssueIds.has(link.annotation_id)).map((link) => link.annotation_id));
  const count = (type: BlueprintOperationalLink["targetType"]) => links.filter((link) => link.target_type === type).length;
  const changeOrderIds = links.filter((link) => link.target_type === "change_order").map((link) => link.target_id);
  const estimateItemIds = links.filter((link) => link.target_type === "estimate_line_item").map((link) => link.target_id);
  const from = (table: string) => (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient["from"]> }).from(table);
  const [changeOrders, estimateItems] = await Promise.all([
    changeOrderIds.length ? from("change_orders").select("total_amount").eq("company_id", input.companyId).in("id", changeOrderIds) : Promise.resolve({ data: [], error: null }),
    estimateItemIds.length ? from("estimate_line_items").select("line_total").eq("company_id", input.companyId).in("id", estimateItemIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (changeOrders.error) throw changeOrders.error;
  if (estimateItems.error) throw estimateItems.error;
  const sum = (rows: Array<Record<string, unknown>>, key: string) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  return { openIssues: openIssueIds.size, unlinkedIssues: openIssueIds.size - linkedOpenIssueIds.size, tasks: count("task"), punchItems: count("punch_item"), changeOrders: count("change_order"), workforceAssignments: count("workforce_assignment"), estimateItems: count("estimate_line_item"), changeOrderValue: sum((changeOrders.data ?? []) as Array<Record<string, unknown>>, "total_amount"), estimateValue: sum((estimateItems.data ?? []) as Array<Record<string, unknown>>, "line_total") };
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

export async function createMaterialRequestFromBlueprintTakeoff(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string }) {
  const response = await (supabase as unknown as {
    rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("create_material_request_from_blueprint_takeoff", {
    p_company_id: input.companyId,
    p_project_id: input.projectId,
    p_blueprint_version_id: input.versionId,
    p_annotation_id: input.annotationId,
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

export async function createRfiFromBlueprintIssue(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string }) {
  const response = await (supabase as unknown as { rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("create_rfi_from_blueprint_issue", {
    p_company_id: input.companyId,
    p_project_id: input.projectId,
    p_blueprint_version_id: input.versionId,
    p_annotation_id: input.annotationId,
  });
  if (response.error) throw new Error(response.error.message);
  return String(response.data);
}

export async function scheduleBlueprintIssueTask(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string; plannedStart: string; plannedFinish: string }) {
  const response = await (supabase as unknown as { rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("schedule_blueprint_issue_task", {
    p_company_id: input.companyId, p_project_id: input.projectId,
    p_blueprint_version_id: input.versionId, p_annotation_id: input.annotationId,
    p_planned_start: input.plannedStart, p_planned_finish: input.plannedFinish,
  });
  if (response.error) throw new Error(response.error.message);
  return String(response.data);
}

export async function createSubmittalFromBlueprintIssue(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; annotationId: string }) {
  const response = await (supabase as unknown as { rpc: (name: string, args: Record<string, string>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("create_submittal_from_blueprint_issue", { p_company_id: input.companyId, p_project_id: input.projectId, p_blueprint_version_id: input.versionId, p_annotation_id: input.annotationId });
  if (response.error) throw new Error(response.error.message);
  return String(response.data);
}
