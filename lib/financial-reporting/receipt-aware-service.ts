import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { buildProjectFinancialReport as buildBaseProjectFinancialReport } from "./service";
import type { FinancialMetricSource, JobCostCategoryRow, ProjectFinancialReport } from "./types";

type ReceiptCostRow = {
  total_amount: number | string | null;
};

function toMoney(value: number) {
  return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0;
}

function safeMoney(value: number | string | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function deriveVarianceStatus(variancePercent: number | null): "on_track" | "at_risk" | "over_budget" {
  if (variancePercent === null) return "on_track";
  if (variancePercent < 0) return "over_budget";
  if (variancePercent <= 10) return "at_risk";
  return "on_track";
}

function uniqueSources(values: FinancialMetricSource[]): FinancialMetricSource[] {
  return Array.from(new Set(values));
}

function applyReceiptCostToMaterials(row: JobCostCategoryRow, receiptCost: number): JobCostCategoryRow {
  const actual = toMoney(row.actual + receiptCost);
  const forecast = toMoney(row.committed + actual);
  const varianceAmount = toMoney(row.budget - forecast);
  const variancePercent = row.budget > 0 ? toMoney((varianceAmount / row.budget) * 100) : null;

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
 * Canonical project financial report with approved field receipts included as actual material cost.
 * Receipt costs never change the customer contract value; they affect actual cost, forecast and profit.
 */
export async function buildProjectFinancialReport(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  projectId: string;
}): Promise<ProjectFinancialReport> {
  const base = await buildBaseProjectFinancialReport(params);
  const queryable = params.supabase as SupabaseClient<Database> & {
    // Receipt tables are migration-backed until generated Supabase types are refreshed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  };

  const receiptResponse = await queryable
    .from("project_receipts")
    .select("total_amount")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .eq("status", "approved");

  if (receiptResponse.error) {
    // During a rolling deployment, the application may briefly run before the additive receipt migration.
    // Preserve the existing project report rather than taking Financials offline.
    if (String(receiptResponse.error.message || "").toLowerCase().includes("project_receipts")) {
      return base;
    }
    throw new Error(receiptResponse.error.message);
  }

  const receiptCost = toMoney(
    ((receiptResponse.data ?? []) as ReceiptCostRow[]).reduce((sum, row) => sum + safeMoney(row.total_amount), 0),
  );

  const actualCost = toMoney(base.summary.actualCost + receiptCost);
  const remainingCostToComplete = toMoney(Math.max(base.summary.revisedBudget - actualCost, 0));
  const forecastFinalCost = toMoney(Math.max(actualCost + base.summary.committedCost, base.summary.revisedBudget));
  const grossProfit = toMoney(base.summary.revisedContractValue - forecastFinalCost);
  const grossMarginPercent = base.summary.revisedContractValue > 0
    ? toMoney((grossProfit / base.summary.revisedContractValue) * 100)
    : null;

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
        actualCost: uniqueSources([...(base.summary.metricSources.actualCost || []), "project_receipts", "derived"]),
      },
    },
    jobCostByCategory: base.jobCostByCategory.map((row) => row.category === "materials" ? applyReceiptCostToMaterials(row, receiptCost) : row),
    materials: {
      ...base.materials,
      actualMaterialCost: toMoney(base.materials.actualMaterialCost + receiptCost),
      source: uniqueSources([...base.materials.source, "project_receipts"]),
    },
    availability: [
      ...base.availability.filter((item) => item.key !== "project_receipts"),
      {
        key: "project_receipts",
        label: "Field Receipt Costs",
        status: "available",
        detail: "Approved project receipts are included in actual material cost, forecast final cost, and projected gross profit.",
      },
    ],
  };
}
