import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { readAllSupabaseRows } from "@/lib/supabase/pagination";

type LaborPlanRow = { project_id: string; projected_cost: number | string };

function cents(value: number | string): number {
  if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !/^\d+(\.\d{1,2})?$/.test(value))) {
    throw new Error("Project labor plan cost is invalid.");
  }
  const parsed = Number(value);
  const result = Math.round(parsed * 100);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(result) || result / 100 !== parsed) {
    throw new Error("Project labor plan cost is invalid.");
  }
  return result;
}

/** Project labor plans are a pooled forecast, not another source of actual wages. */
export function outstandingLaborPlanCost(planned: number, approvedPayroll: number): number {
  return Math.max(cents(planned) - cents(approvedPayroll), 0) / 100;
}

export const LABOR_PLAN_DETAIL = "Project employee and crew plans form a pooled labor forecast. Approved/exported payroll allocated to the same project reduces the outstanding plan dollar for dollar, never below zero. Plans and manually entered actual hours/costs are not added as actual wages. Employer taxes, benefits and unallocated historical payroll remain excluded.";

/** Use only after the existing payroll cost access gate has allowed finance reporting. */
export async function loadProjectLaborPlans(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  projectId?: string;
}): Promise<Map<string, number>> {
  const db = params.supabase as SupabaseClient<Database> & {
    // This migration-backed table precedes generated database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  };
  const response = await readAllSupabaseRows<LaborPlanRow>((from, to) => {
    let query = db.from("project_labor_commitments").select("project_id,projected_cost").eq("company_id", params.companyId);
    if (params.projectId) query = query.eq("project_id", params.projectId);
    return query.order("id", { ascending: true }).range(from, to);
  });
  if (response.error) throw new Error(`Project labor plans could not be loaded: ${response.error.message}`);
  const totals = new Map<string, number>();
  for (const row of response.data ?? []) {
    if (typeof row.project_id !== "string" || !row.project_id || (params.projectId && row.project_id !== params.projectId)) {
      throw new Error("Project labor plan scope is invalid.");
    }
    const total = (totals.get(row.project_id) ?? 0) + cents(row.projected_cost);
    if (!Number.isSafeInteger(total)) throw new Error("Project labor plan total is invalid.");
    totals.set(row.project_id, total);
  }
  return new Map([...totals].map(([id, total]) => [id, total / 100]));
}
