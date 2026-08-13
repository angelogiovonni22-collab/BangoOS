import type { SupabaseClient } from "@supabase/supabase-js";

export type BlueprintMarkupType = "freehand" | "arrow" | "text" | "pin" | "calibration" | "distance" | "area" | "symbol" | "wall" | "locked_dimension";

export type BlueprintMarkup = {
  id: string;
  type: BlueprintMarkupType;
  color: string;
  geometry: Record<string, unknown>;
  content: string;
  createdBy: string;
  createdAt: string;
  status: "open" | "resolved";
  discipline: string;
  layerId: string | null;
};

type MarkupIdentity = {
  companyId: string;
  projectId: string;
  versionId: string;
};

function blueprintAnnotations(supabase: SupabaseClient) {
  return (supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_annotations");
}

export async function loadBlueprintMarkups(supabase: SupabaseClient, identity: MarkupIdentity) {
  const response = await blueprintAnnotations(supabase)
    .select("id, annotation_type, color, geometry, content, status, discipline, layer_id, created_by, created_at")
    .eq("company_id", identity.companyId)
    .eq("project_id", identity.projectId)
    .eq("blueprint_version_id", identity.versionId)
    .order("created_at", { ascending: true });
  if (response.error) throw response.error;

  return ((response.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    type: String(row.annotation_type) as BlueprintMarkupType,
    color: String(row.color),
    geometry: row.geometry as Record<string, unknown>,
    content: typeof row.content === "string" ? row.content : "",
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    status: row.status === "resolved" ? "resolved" : "open",
    discipline: String(row.discipline || "Architectural"),
    layerId: typeof row.layer_id === "string" ? row.layer_id : null,
  } satisfies BlueprintMarkup));
}

export async function updateBlueprintMarkupStatus(
  supabase: SupabaseClient,
  identity: MarkupIdentity & { markupId: string; status: "open" | "resolved" },
) {
  const response = await blueprintAnnotations(supabase)
    .update({ status: identity.status, updated_at: new Date().toISOString() })
    .eq("id", identity.markupId)
    .eq("company_id", identity.companyId)
    .eq("project_id", identity.projectId)
    .eq("blueprint_version_id", identity.versionId);
  if (response.error) throw response.error;
}

export async function createBlueprintMarkup(
  supabase: SupabaseClient,
  input: MarkupIdentity & {
    userId: string;
    type: BlueprintMarkupType;
    color: string;
    geometry: Record<string, unknown>;
    content?: string;
    discipline?: string;
    layerId?: string | null;
  },
) {
  const response = await blueprintAnnotations(supabase).insert({
    company_id: input.companyId,
    project_id: input.projectId,
    blueprint_version_id: input.versionId,
    annotation_type: input.type,
    color: input.color,
    geometry: input.geometry,
    content: input.content?.trim() || null,
    discipline: input.discipline || "Architectural",
    layer_id: input.layerId || null,
    created_by: input.userId,
  });
  if (response.error) throw response.error;
}

export async function deleteBlueprintMarkup(
  supabase: SupabaseClient,
  identity: MarkupIdentity & { markupId: string },
) {
  const response = await blueprintAnnotations(supabase)
    .delete()
    .eq("id", identity.markupId)
    .eq("company_id", identity.companyId)
    .eq("project_id", identity.projectId)
    .eq("blueprint_version_id", identity.versionId);
  if (response.error) throw response.error;
}
