import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DataAvailability } from "./types";

type ProjectPayrollCost = { grossPay: number; hours: number };
export type PayrollJobCosts = {
  projects: Map<string, ProjectPayrollCost>;
  availability: DataAvailability;
  accessible: boolean;
};

type RpcResponse = { data: unknown; error: { message: string } | null };
type PayrollRpc = (name: "get_payroll_job_cost_totals", args: { p_company_id: string }) => PromiseLike<RpcResponse>;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Payroll job-cost totals are invalid");
  return value as Record<string, unknown>;
}
function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error("Payroll job-cost totals are invalid");
  return value;
}

function currency(value: unknown): number {
  const parsed = amount(value);
  const cents = Math.round(parsed * 100);
  if (!Number.isSafeInteger(cents) || cents / 100 !== parsed) throw new Error("Payroll wage amounts are invalid");
  return parsed;
}

export async function loadPayrollJobCosts(params: { supabase: SupabaseClient<Database>; companyId: string }): Promise<PayrollJobCosts> {
  const rpc = params.supabase.rpc.bind(params.supabase) as unknown as PayrollRpc;
  const response = await rpc("get_payroll_job_cost_totals", { p_company_id: params.companyId });
  if (response.error) throw new Error(`Payroll job-cost totals could not be loaded: ${response.error.message}`);
  const data = record(response.data);
  if (data.status === "unavailable" && data.reason === "finance_role_required") {
    return { projects: new Map(), accessible: false, availability: {
      key: "payroll_job_cost", label: "Approved Payroll Job Cost", status: "unavailable",
      detail: "Payroll wage costs require an owner, administrator, office manager, or accountant role. This report excludes payroll wages for this account.",
    } };
  }
  if ((data.status !== "available" && data.status !== "partial") || data.company_id !== params.companyId || !Array.isArray(data.projects)) {
    throw new Error("Payroll job-cost totals are invalid or belong to another company");
  }
  const projects = new Map<string, ProjectPayrollCost>();
  let allocated = 0;
  for (const value of data.projects) {
    const row = record(value);
    if (typeof row.project_id !== "string" || !row.project_id || projects.has(row.project_id)) throw new Error("Payroll project costs are invalid");
    const grossPay = currency(row.gross_pay);
    const hours = amount(row.hours);
    allocated += grossPay;
    projects.set(row.project_id, { grossPay, hours });
  }
  const unassigned = currency(data.unassigned_gross_pay);
  const unknown = currency(data.unknown_gross_pay);
  const unknownLines = amount(data.unknown_line_count);
  const approvedGross = currency(data.approved_gross_pay);
  const approvedLines = amount(data.approved_line_count);
  if (!Number.isInteger(unknownLines) || !Number.isInteger(approvedLines) || unknownLines > approvedLines
    || Math.round((allocated + unassigned + unknown) * 100) !== Math.round(approvedGross * 100)
    || (unknownLines === 0 && unknown !== 0)
    || (approvedLines === 0 && (approvedGross !== 0 || projects.size > 0 || unassigned !== 0))
    || (data.status === "available" && unknownLines !== 0) || (data.status === "partial" && unknownLines === 0)) {
    throw new Error("Payroll project costs do not reconcile to approved wages");
  }
  let detail = "Recorded approved/exported gross wages feed project actual labor cost. Drafts, voids, unprocessed time, employer taxes, and benefit burdens are excluded; project costs use the recorded proportional-hours allocation.";
  if (unknownLines > 0) detail += ` ${unknownLines} historical payroll line(s), totaling $${unknown.toFixed(2)}, lack supported project snapshots and are excluded rather than reconstructed.`;
  if (unassigned > 0) detail += ` $${unassigned.toFixed(2)} has no project assignment and is excluded from project forecasts.`;
  return { projects, accessible: true, availability: { key: "payroll_job_cost", label: "Approved Payroll Job Cost", status: "partial", detail } };
}
