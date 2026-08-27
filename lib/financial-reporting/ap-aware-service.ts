import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { buildProjectFinancialReport as buildReceiptAwareProjectFinancialReport } from "./receipt-aware-service";
import type {
  AccountsPayableJobCostSnapshot,
  FinancialMetricSource,
  JobCostCategoryKey,
  JobCostCategoryRow,
  ProjectFinancialReport,
} from "./types";

type VendorBillRow = {
  id: string;
  status: string | null;
  total_amount: number | string | null;
  amount_paid: number | string | null;
  balance_due: number | string | null;
  match_status: string | null;
};

type VendorBillLineRow = {
  vendor_bill_id: string;
  purchase_order_line_item_id: string | null;
  category: string | null;
  line_amount: number | string | null;
};

const ACTUAL_BILL_STATUSES = new Set(["approved", "partially_paid", "paid"]);

function money(value: number) {
  return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;
}

function safeMoney(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function uniqueSources(values: FinancialMetricSource[]): FinancialMetricSource[] {
  return Array.from(new Set(values));
}

function mapBillCategory(category: string | null): JobCostCategoryKey {
  switch (String(category || "").trim().toLowerCase()) {
    case "materials":
      return "materials";
    case "subcontractor":
    case "professional_service":
      return "vendors";
    case "equipment":
    case "rental":
      return "equipment";
    default:
      return "other";
  }
}

function deriveVarianceStatus(variancePercent: number | null): "on_track" | "at_risk" | "over_budget" {
  if (variancePercent === null) return "on_track";
  if (variancePercent < 0) return "over_budget";
  if (variancePercent <= 10) return "at_risk";
  return "on_track";
}

function applyActualCost(row: JobCostCategoryRow, additionalActual: number): JobCostCategoryRow {
  if (additionalActual <= 0) return row;
  const actual = money(row.actual + additionalActual);
  const forecast = money(Math.max(actual + row.committed, row.budget));
  const varianceAmount = money(row.budget - forecast);
  const variancePercent = row.budget > 0 ? money((varianceAmount / row.budget) * 100) : null;
  return {
    ...row,
    actual,
    forecast,
    varianceAmount,
    variancePercent,
    status: deriveVarianceStatus(variancePercent),
    dataStatus: "measured",
    note: null,
  };
}

/**
 * Canonical project financial report with approved AP costs included.
 *
 * PO-linked bill lines are deliberately excluded from the incremental AP actual-cost
 * amount because the base report already recognizes those costs through the
 * procurement/inventory allocation chain. This prevents the same material from being
 * counted once as a project allocation and again as a vendor invoice.
 *
 * Non-PO approved bills (subcontractors, permits, professional services, rentals,
 * overhead and other direct project costs) become actual job cost when approved.
 */
export async function buildProjectFinancialReport(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  projectId: string;
}): Promise<ProjectFinancialReport> {
  const base = await buildReceiptAwareProjectFinancialReport(params);
  const db = params.supabase as SupabaseClient<Database> & {
    // Finance tables are migration-backed and intentionally queried without generated-type coupling.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  };

  const billsResponse = await db
    .from("vendor_bills")
    .select("id,status,total_amount,amount_paid,balance_due,match_status")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .neq("status", "voided");

  if (billsResponse.error) {
    if (String(billsResponse.error.message || "").toLowerCase().includes("vendor_bills")) return base;
    throw new Error(billsResponse.error.message);
  }

  const bills = (billsResponse.data ?? []) as VendorBillRow[];
  const actualBills = bills.filter((bill) => ACTUAL_BILL_STATUSES.has(String(bill.status || "")));
  const actualBillIds = actualBills.map((bill) => bill.id);

  const linesResponse = actualBillIds.length > 0
    ? await db
      .from("vendor_bill_line_items")
      .select("vendor_bill_id,purchase_order_line_item_id,category,line_amount")
      .eq("company_id", params.companyId)
      .eq("project_id", params.projectId)
      .in("vendor_bill_id", actualBillIds)
    : { data: [], error: null };

  if (linesResponse.error) throw new Error(linesResponse.error.message);
  const lines = (linesResponse.data ?? []) as VendorBillLineRow[];

  const incrementalByCategory: Record<JobCostCategoryKey, number> = {
    labor: 0,
    materials: 0,
    equipment: 0,
    vendors: 0,
    other: 0,
  };

  for (const line of lines) {
    if (line.purchase_order_line_item_id) continue;
    const category = mapBillCategory(line.category);
    incrementalByCategory[category] += safeMoney(line.line_amount);
  }

  const incrementalActual = money(Object.values(incrementalByCategory).reduce((sum, value) => sum + value, 0));
  const actualCost = money(base.summary.actualCost + incrementalActual);
  const remainingCostToComplete = money(Math.max(base.summary.revisedBudget - actualCost, 0));
  const forecastFinalCost = money(Math.max(actualCost + base.summary.committedCost, base.summary.revisedBudget));
  const grossProfit = money(base.summary.revisedContractValue - forecastFinalCost);
  const grossMarginPercent = base.summary.revisedContractValue > 0
    ? money((grossProfit / base.summary.revisedContractValue) * 100)
    : null;

  const accountsPayable: AccountsPayableJobCostSnapshot = {
    approvedBillCost: money(actualBills.reduce((sum, bill) => sum + safeMoney(bill.total_amount), 0)),
    paidBillCost: money(actualBills.reduce((sum, bill) => sum + safeMoney(bill.amount_paid), 0)),
    outstandingApprovedCost: money(actualBills.reduce((sum, bill) => sum + safeMoney(bill.balance_due), 0)),
    billCount: bills.length,
    matchedBillCount: bills.filter((bill) => bill.match_status === "matched").length,
    needsReviewBillCount: bills.filter((bill) => bill.match_status !== "matched").length,
    source: ["vendor_bills", "vendor_bill_line_items"],
  };

  return {
    ...base,
    summary: {
      ...base.summary,
      actualCost,
      remainingCostToComplete,
      forecastFinalCost,
      grossProfit,
      grossMarginPercent,
      metricSources: {
        ...base.summary.metricSources,
        actualCost: uniqueSources([
          ...(base.summary.metricSources.actualCost || []),
          "vendor_bills",
          "vendor_bill_line_items",
          "derived",
        ]),
      },
    },
    jobCostByCategory: base.jobCostByCategory.map((row) => applyActualCost(row, incrementalByCategory[row.category])),
    vendors: {
      ...base.vendors,
      actualVendorCost: money((base.vendors.actualVendorCost || 0) + incrementalByCategory.vendors),
      source: uniqueSources([...base.vendors.source, "vendor_bills", "vendor_bill_line_items"]),
      note: "Approved non-PO subcontractor and professional-service bills are included as actual vendor cost.",
    },
    materials: {
      ...base.materials,
      actualMaterialCost: money(base.materials.actualMaterialCost + incrementalByCategory.materials),
      source: uniqueSources([...base.materials.source, "vendor_bills", "vendor_bill_line_items"]),
    },
    accountsPayable,
    availability: [
      ...base.availability.filter((item) => item.key !== "accounts_payable_job_cost"),
      {
        key: "accounts_payable_job_cost",
        label: "Accounts Payable Job Cost",
        status: "available",
        detail: "Approved project vendor bills feed actual job cost. PO-linked bill lines are de-duplicated against the procurement/inventory cost chain.",
      },
    ],
  };
}
