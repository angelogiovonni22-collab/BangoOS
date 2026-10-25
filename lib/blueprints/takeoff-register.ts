import type { SupabaseClient } from "@supabase/supabase-js";
import { validMeasurementMetric } from "./measurement-metric";

type TakeoffRow = { id: string; annotation_type: "distance" | "area"; geometry: Record<string, unknown> };

export type BlueprintTakeoffSummary = { distances: number; areas: number; linearFeet: number; squareFeet: number; linked: number; unlinked: number; unverified: number };

export async function loadBlueprintTakeoffSummary(supabase: SupabaseClient, input: { companyId: string; projectId: string }): Promise<BlueprintTakeoffSummary> {
  const from = (table: string) => (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient["from"]> }).from(table);
  const [takeoffs, links] = await Promise.all([
    from("blueprint_annotations").select("id, annotation_type, geometry").eq("company_id", input.companyId).eq("project_id", input.projectId).in("annotation_type", ["distance", "area"]),
    from("blueprint_operational_links").select("annotation_id").eq("company_id", input.companyId).eq("project_id", input.projectId).eq("target_type", "estimate_line_item"),
  ]);
  if (takeoffs.error) throw takeoffs.error;
  if (links.error) throw links.error;
  const rows = (takeoffs.data ?? []) as TakeoffRow[];
  const linkedIds = new Set(((links.data ?? []) as Array<{ annotation_id: string }>).map((row) => row.annotation_id));
  return summarizeBlueprintTakeoffs(rows, linkedIds);
}

export function summarizeBlueprintTakeoffs(rows: TakeoffRow[], linkedIds: Set<string>): BlueprintTakeoffSummary {
  const verified = rows.filter((row) => {
    const value = row.geometry.value, unit = String(row.geometry.unit ?? "").toLowerCase();
    return validMeasurementMetric(row.geometry) && typeof value === "number" && Number.isFinite(value) && value >= 0
      && typeof row.geometry.calibrationId === "string" && row.geometry.calibrationId.length > 0
      && (row.annotation_type === "distance" ? ["ft", "m"].includes(unit) : ["ft²", "ft2", "m²", "m2"].includes(unit));
  });
  let linearFeet = 0, squareFeet = 0;
  for (const row of verified) {
    const value = Number(row.geometry.value ?? 0), unit = String(row.geometry.unit ?? "").toLowerCase();
    if (row.annotation_type === "distance") linearFeet += unit === "m" ? value * 3.280839895 : value;
    else squareFeet += ["m²", "m2"].includes(unit) ? value * 10.763910417 : value;
  }
  const linked = verified.filter((row) => linkedIds.has(row.id)).length;
  return { distances: verified.filter((row) => row.annotation_type === "distance").length, areas: verified.filter((row) => row.annotation_type === "area").length, linearFeet, squareFeet, linked, unlinked: verified.length - linked, unverified: rows.length - verified.length };
}
