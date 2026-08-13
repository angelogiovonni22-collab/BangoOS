import type { SupabaseClient } from "@supabase/supabase-js";

export type BlueprintTakeoffSummary = { distances: number; areas: number; linearFeet: number; squareFeet: number; linked: number; unlinked: number };

export async function loadBlueprintTakeoffSummary(supabase: SupabaseClient, input: { companyId: string; projectId: string }): Promise<BlueprintTakeoffSummary> {
  const from = (table: string) => (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient["from"]> }).from(table);
  const [takeoffs, links] = await Promise.all([
    from("blueprint_annotations").select("id, annotation_type, geometry").eq("company_id", input.companyId).eq("project_id", input.projectId).in("annotation_type", ["distance", "area"]),
    from("blueprint_operational_links").select("annotation_id").eq("company_id", input.companyId).eq("project_id", input.projectId).eq("target_type", "estimate_line_item"),
  ]);
  if (takeoffs.error) throw takeoffs.error;
  if (links.error) throw links.error;
  const rows = (takeoffs.data ?? []) as Array<{ id: string; annotation_type: "distance" | "area"; geometry: Record<string, unknown> }>;
  const linkedIds = new Set(((links.data ?? []) as Array<{ annotation_id: string }>).map((row) => row.annotation_id));
  let linearFeet = 0, squareFeet = 0;
  for (const row of rows) {
    const value = Number(row.geometry.value ?? 0), unit = String(row.geometry.unit ?? "").toLowerCase();
    if (row.annotation_type === "distance") linearFeet += unit === "m" ? value * 3.280839895 : value;
    else squareFeet += ["m²", "m2"].includes(unit) ? value * 10.763910417 : value;
  }
  const linked = rows.filter((row) => linkedIds.has(row.id)).length;
  return { distances: rows.filter((row) => row.annotation_type === "distance").length, areas: rows.filter((row) => row.annotation_type === "area").length, linearFeet, squareFeet, linked, unlinked: rows.length - linked };
}
