import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { UnitUsageCount, UnitUsageSummary } from "./types";

type UsageCheckContext = {
  companyId: string;
  unitCode: string;
  isSystem: boolean;
};

type UsageTarget = {
  table: string;
  column: string;
};

const USAGE_TARGETS: UsageTarget[] = [
  { table: "materials", column: "unit_of_measure" },
  { table: "equipment", column: "default_unit_of_measure" },
  { table: "labor_rates", column: "production_unit" },
  { table: "estimate_line_items", column: "unit" },
  { table: "invoice_line_items", column: "unit" },
  { table: "change_order_line_items", column: "unit" },
];

export async function getUnitUsageSummary(
  supabase: SupabaseClient<Database>,
  context: UsageCheckContext,
): Promise<UnitUsageSummary> {
  const normalizedCode = context.unitCode.trim().toUpperCase();

  const queries = USAGE_TARGETS.map(async (target) => {
    let request = supabase
      .from(target.table as never)
      .select("id", { count: "exact", head: true })
      .ilike(target.column, normalizedCode);

    if (!context.isSystem) {
      request = request.eq("company_id", context.companyId);
    }

    const { count, error } = await request;

    if (error) {
      return null;
    }

    return {
      table: target.table,
      column: target.column,
      count: count ?? 0,
    } satisfies UnitUsageCount;
  });

  const results = await Promise.all(queries);
  const references = results.filter((entry): entry is UnitUsageCount => Boolean(entry && entry.count > 0));
  const totalReferences = references.reduce((sum, item) => sum + item.count, 0);

  return {
    totalReferences,
    references,
  };
}
