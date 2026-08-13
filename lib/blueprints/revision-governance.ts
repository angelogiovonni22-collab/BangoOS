import type { SupabaseClient } from "@supabase/supabase-js";

const from = (supabase: SupabaseClient, table: string) => (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient["from"]> }).from(table);

export async function loadBlueprintRevisionGovernance(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; userId: string }) {
  const [version, acknowledgments] = await Promise.all([
    from(supabase, "blueprint_versions").select("status").eq("id", input.versionId).eq("company_id", input.companyId).eq("project_id", input.projectId).maybeSingle(),
    from(supabase, "blueprint_revision_acknowledgments").select("acknowledged_by").eq("company_id", input.companyId).eq("project_id", input.projectId).eq("blueprint_version_id", input.versionId),
  ]);
  if (version.error) throw version.error;
  if (acknowledgments.error) throw acknowledgments.error;
  const rows = (acknowledgments.data ?? []) as Array<{ acknowledged_by: string }>;
  return { status: String((version.data as { status?: string } | null)?.status || "draft"), acknowledgmentCount: rows.length, acknowledgedByMe: rows.some((row) => row.acknowledged_by === input.userId) };
}

export async function acknowledgeBlueprintRevision(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; userId: string }) {
  const response = await from(supabase, "blueprint_revision_acknowledgments").upsert({ company_id: input.companyId, project_id: input.projectId, blueprint_version_id: input.versionId, acknowledged_by: input.userId }, { onConflict: "blueprint_version_id,acknowledged_by" });
  if (response.error) throw response.error;
}

export async function setBlueprintRevisionReviewStatus(supabase: SupabaseClient, input: { companyId: string; projectId: string; versionId: string; status: "in_review" | "approved" }) {
  const response = await (supabase as unknown as { rpc: (name: string, args: Record<string, string>) => Promise<{ error: { message: string } | null }> }).rpc("set_blueprint_revision_review_status", { p_company_id: input.companyId, p_project_id: input.projectId, p_blueprint_version_id: input.versionId, p_status: input.status });
  if (response.error) throw new Error(response.error.message);
}
