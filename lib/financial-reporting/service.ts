import { readAllSupabaseRows, readAllSupabaseRowsForIds } from "@/lib/supabase/pagination";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import type { Database } from "@/types/database.types";
import { loadCompanyProjectCosts } from "./company-project-costs";
import type {
  CompanyFinancialReport,
  CostCodeVarianceRow,
  DataAvailability,
  JobCostCategoryKey,
  JobCostCategoryRow,
  ProjectFinancialReport,
} from "./types";

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "status" | "contract_amount" | "estimated_cost"
>;

type EstimateRow = Pick<
  Database["public"]["Tables"]["estimates"]["Row"],
  "id" | "project_id" | "status" | "total_amount" | "internal_cost_total" | "created_at"
>;

type EstimateLineItemRow = Pick<
  Database["public"]["Tables"]["estimate_line_items"]["Row"],
  "estimate_id" | "category" | "quantity" | "unit_cost"
>;

type ChangeOrderRow = Pick<
  Database["public"]["Tables"]["change_orders"]["Row"],
  "id" | "project_id" | "status" | "total_amount"
>;

type ChangeOrderLineItemRow = Pick<
  Database["public"]["Tables"]["change_order_line_items"]["Row"],
  "change_order_id" | "cost_amount"
>;

type InvoiceRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  "id" | "project_id" | "status" | "total_amount" | "amount_paid" | "company_id"
>;

type InvoicePaymentRow = Pick<
  Database["public"]["Tables"]["invoice_payment_history"]["Row"],
  "invoice_id" | "amount" | "status"
>;

type CostCodeRow = Pick<
  Database["public"]["Tables"]["cost_codes"]["Row"],
  "id" | "code" | "name" | "budget" | "committed_cost" | "actual_cost"
>;

type TradePartnerAssignmentRow = Pick<
  Database["public"]["Tables"]["trade_partner_assignments"]["Row"],
  "id" | "project_id" | "assignment_status" | "contract_status" | "contract_amount" | "retainage_percent"
>;

type TaskRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "actual_hours"
>;

type EquipmentRow = Pick<
  Database["public"]["Tables"]["equipment"]["Row"],
  "id" | "daily_internal_cost" | "rental_daily_cost" | "maintenance_cost_per_hour"
>;

type PurchaseOrderRow = {
  id: string;
  project_id: string;
  vendor_id: string;
  status: string;
  total_amount: number;
  cost_code_id: string | null;
};

type PurchaseOrderLineItemRow = {
  id: string;
  purchase_order_id: string;
  project_id: string;
  cost_code_id: string | null;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
  unit_cost: number;
};

type ProjectMaterialAllocationRow = {
  project_id: string;
  cost_code_id: string | null;
  total_cost: number;
};

type MaterialRequestRow = {
  id: string;
};

type ProjectScopeCostRow = {
  material_cost: number;
  labor_cost: number;
};

type QueryableSupabase = SupabaseClient<Database> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

const APPROVED_CHANGE_ORDER_STATUSES = new Set(["approved", "invoiced"]);
const NON_COMMITTED_PURCHASE_ORDER_STATUSES = new Set(["draft", "cancelled", "fully_received"]);
const RELEVANT_ESTIMATE_STATUSES = new Set([
  "draft",
  "internal_review",
  "sent",
  "viewed",
  "approved",
  "ready",
  "revision_requested",
]);
const ACTIVE_PROJECT_STATUSES = new Set(["approved", "scheduled", "in_progress"]);

function toMoney(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Prefer each invoice's history independently; ignore void invoices and orphan payments. */
function receivedPayments(invoices: InvoiceRow[], payments: InvoicePaymentRow[]): number {
  const history = new Map<string, number>();
  for (const payment of payments) {
    const recorded = payment.status.trim().toLowerCase() === "recorded" ? safeNumber(payment.amount) : 0;
    history.set(payment.invoice_id, (history.get(payment.invoice_id) ?? 0) + recorded);
  }
  return toMoney(invoices.reduce((sum, invoice) => {
    if (normalizeInvoiceStatus(invoice.status) === "void") return sum;
    return sum + (history.has(invoice.id) ? history.get(invoice.id)! : safeNumber(invoice.amount_paid));
  }, 0));
}

function isApprovedChangeOrder(status: string) {
  return APPROVED_CHANGE_ORDER_STATUSES.has(normalizeChangeOrderStatus(status));
}

function deriveVarianceStatus(variancePercent: number | null): "on_track" | "at_risk" | "over_budget" {
  if (variancePercent === null) {
    return "on_track";
  }

  if (variancePercent < 0) {
    return "over_budget";
  }

  if (variancePercent <= 10) {
    return "at_risk";
  }

  return "on_track";
}

function mapEstimateCategory(category: string): JobCostCategoryKey {
  const normalized = category.trim().toLowerCase();

  if (normalized === "labor") {
    return "labor";
  }

  if (normalized === "materials") {
    return "materials";
  }

  if (normalized === "equipment") {
    return "equipment";
  }

  if (normalized === "subcontractors") {
    return "vendors";
  }

  return "other";
}

function createBaseCategoryRows(): Record<JobCostCategoryKey, JobCostCategoryRow> {
  const base: Record<JobCostCategoryKey, JobCostCategoryRow> = {
    labor: {
      category: "labor",
      budget: 0,
      committed: 0,
      actual: 0,
      forecast: 0,
      varianceAmount: 0,
      variancePercent: null,
      status: "unavailable",
      dataStatus: "unavailable",
      note: "Labor cost is unavailable until timesheets are linked to labor rates.",
    },
    materials: {
      category: "materials",
      budget: 0,
      committed: 0,
      actual: 0,
      forecast: 0,
      varianceAmount: 0,
      variancePercent: null,
      status: "unavailable",
      dataStatus: "unavailable",
      note: "",
    },
    equipment: {
      category: "equipment",
      budget: 0,
      committed: 0,
      actual: 0,
      forecast: 0,
      varianceAmount: 0,
      variancePercent: null,
      status: "unavailable",
      dataStatus: "unavailable",
      note: "Equipment usage cost is unavailable until usage hours are captured.",
    },
    vendors: {
      category: "vendors",
      budget: 0,
      committed: 0,
      actual: 0,
      forecast: 0,
      varianceAmount: 0,
      variancePercent: null,
      status: "unavailable",
      dataStatus: "partial",
      note: "Committed vendor cost is available from trade partner contracts.",
    },
    other: {
      category: "other",
      budget: 0,
      committed: 0,
      actual: 0,
      forecast: 0,
      varianceAmount: 0,
      variancePercent: null,
      status: "unavailable",
      dataStatus: "partial",
      note: "Other costs are currently budget-driven.",
    },
  };

  return base;
}

async function loadProcurementRows(
  supabase: QueryableSupabase,
  companyId: string,
  projectId: string,
): Promise<{
  purchaseOrders: PurchaseOrderRow[];
  purchaseOrderLines: PurchaseOrderLineItemRow[];
  projectMaterialAllocations: ProjectMaterialAllocationRow[];
  materialRequests: MaterialRequestRow[];
}> {
  const [purchaseOrdersResponse, purchaseOrderLinesResponse, allocationsResponse, requestsResponse] = await Promise.all([
    readAllSupabaseRows((from, to) => supabase
      .from("purchase_orders")
      .select("id, project_id, vendor_id, status, total_amount, cost_code_id")
      .eq("company_id", companyId)
      .eq("project_id", projectId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("purchase_order_line_items")
      .select("id, purchase_order_id, project_id, cost_code_id, quantity_ordered, quantity_received, quantity_damaged, unit_cost")
      .eq("company_id", companyId)
      .eq("project_id", projectId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("project_material_allocations")
      .select("project_id, cost_code_id, total_cost")
      .eq("company_id", companyId)
      .eq("project_id", projectId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("material_requests")
      .select("id")
      .eq("company_id", companyId)
      .eq("project_id", projectId).order("id", { ascending: true }).range(from, to)),
  ]);

  if (purchaseOrdersResponse.error) {
    throw new Error(purchaseOrdersResponse.error.message);
  }

  if (purchaseOrderLinesResponse.error) {
    throw new Error(purchaseOrderLinesResponse.error.message);
  }

  if (allocationsResponse.error) {
    throw new Error(allocationsResponse.error.message);
  }

  if (requestsResponse.error) {
    throw new Error(requestsResponse.error.message);
  }

  return {
    purchaseOrders: (purchaseOrdersResponse.data ?? []) as PurchaseOrderRow[],
    purchaseOrderLines: (purchaseOrderLinesResponse.data ?? []) as PurchaseOrderLineItemRow[],
    projectMaterialAllocations: (allocationsResponse.data ?? []) as ProjectMaterialAllocationRow[],
    materialRequests: (requestsResponse.data ?? []) as MaterialRequestRow[],
  };
}

export async function buildProjectFinancialReport(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  projectId: string;
}): Promise<ProjectFinancialReport> {
  const supabase = params.supabase;
  const queryable = supabase as QueryableSupabase;

  const projectResponse = await supabase
    .from("projects")
    .select("id, name, status, contract_amount, estimated_cost")
    .eq("company_id", params.companyId)
    .eq("id", params.projectId)
    .maybeSingle<ProjectRow>();

  if (projectResponse.error) {
    throw new Error(projectResponse.error.message);
  }

  if (!projectResponse.data) {
    throw new Error("Project not found.");
  }

  const project = projectResponse.data;

  const [
    estimatesResponse,
    changeOrdersResponse,
    invoicesResponse,
    costCodesResponse,
    tradePartnersResponse,
    tasksResponse,
    equipmentResponse,
    scopeItemsResponse,
    procurement,
  ] = await Promise.all([
    readAllSupabaseRows((from, to) => supabase
      .from("estimates")
      .select("id, project_id, status, total_amount, internal_cost_total, created_at")
      .eq("company_id", params.companyId)
      .eq("project_id", params.projectId)
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("change_orders")
      .select("id, project_id, status, total_amount")
      .eq("company_id", params.companyId)
      .eq("project_id", params.projectId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("invoices")
      .select("id, project_id, status, total_amount, amount_paid, company_id")
      .eq("company_id", params.companyId)
      .eq("project_id", params.projectId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("cost_codes")
      .select("id, code, name, budget, committed_cost, actual_cost")
      .eq("company_id", params.companyId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("trade_partner_assignments")
      .select("id, project_id, assignment_status, contract_status, contract_amount, retainage_percent")
      .eq("company_id", params.companyId)
      .eq("project_id", params.projectId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("tasks")
      .select("actual_hours")
      .eq("company_id", params.companyId)
      .eq("project_id", params.projectId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => supabase
      .from("equipment")
      .select("id, daily_internal_cost, rental_daily_cost, maintenance_cost_per_hour")
      .eq("company_id", params.companyId)
      .eq("assigned_job_id", params.projectId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => queryable
      .from("project_scope_items")
      .select("material_cost,labor_cost")
      .eq("company_id", params.companyId)
      .eq("project_id", params.projectId).order("id", { ascending: true }).range(from, to)),
    loadProcurementRows(queryable, params.companyId, params.projectId),
  ]);

  if (estimatesResponse.error) {
    throw new Error(estimatesResponse.error.message);
  }

  if (changeOrdersResponse.error) {
    throw new Error(changeOrdersResponse.error.message);
  }

  if (invoicesResponse.error) {
    throw new Error(invoicesResponse.error.message);
  }

  if (costCodesResponse.error) {
    throw new Error(costCodesResponse.error.message);
  }

  if (tradePartnersResponse.error) {
    throw new Error(tradePartnersResponse.error.message);
  }

  if (tasksResponse.error) {
    throw new Error(tasksResponse.error.message);
  }

  if (equipmentResponse.error) {
    throw new Error(equipmentResponse.error.message);
  }

  if (scopeItemsResponse.error) {
    throw new Error(scopeItemsResponse.error.message);
  }

  const estimates = (estimatesResponse.data ?? []) as EstimateRow[];
  const estimateIds = estimates.map((estimate) => estimate.id);

  const estimateLineItemsResponse = estimateIds.length > 0
    ? await readAllSupabaseRowsForIds(estimateIds, (ids, from, to) => supabase
      .from("estimate_line_items")
      .select("estimate_id, category, quantity, unit_cost")
      .eq("company_id", params.companyId)
      .in("estimate_id", ids).order("id", { ascending: true }).range(from, to))
    : { data: [], error: null };

  if (estimateLineItemsResponse.error) {
    throw new Error(estimateLineItemsResponse.error.message);
  }

  const changeOrders = (changeOrdersResponse.data ?? []) as ChangeOrderRow[];
  const approvedChangeOrderIds = changeOrders
    .filter((changeOrder) => isApprovedChangeOrder(changeOrder.status))
    .map((changeOrder) => changeOrder.id);

  const changeOrderLineItemsResponse = approvedChangeOrderIds.length > 0
    ? await readAllSupabaseRowsForIds(approvedChangeOrderIds, (ids, from, to) => supabase
      .from("change_order_line_items")
      .select("change_order_id, cost_amount")
      .eq("company_id", params.companyId)
      .in("change_order_id", ids).order("id", { ascending: true }).range(from, to))
    : { data: [], error: null };

  if (changeOrderLineItemsResponse.error) {
    throw new Error(changeOrderLineItemsResponse.error.message);
  }

  const invoices = (invoicesResponse.data ?? []) as InvoiceRow[];
  const invoiceIds = invoices.map((invoice) => invoice.id);

  const paymentResponse = invoiceIds.length > 0
    ? await readAllSupabaseRowsForIds(invoiceIds, (ids, from, to) => supabase
      .from("invoice_payment_history")
      .select("invoice_id, amount, status")
      .eq("company_id", params.companyId)
      .in("invoice_id", ids).order("id", { ascending: true }).range(from, to))
    : { data: [], error: null };

  if (paymentResponse.error) {
    throw new Error(paymentResponse.error.message);
  }

  const estimateLineItems = (estimateLineItemsResponse.data ?? []) as EstimateLineItemRow[];
  const approvedChangeOrderLineItems = (changeOrderLineItemsResponse.data ?? []) as ChangeOrderLineItemRow[];
  const payments = (paymentResponse.data ?? []) as InvoicePaymentRow[];
  const costCodes = (costCodesResponse.data ?? []) as CostCodeRow[];
  const tradePartners = (tradePartnersResponse.data ?? []) as TradePartnerAssignmentRow[];
  const taskRows = (tasksResponse.data ?? []) as TaskRow[];
  const equipmentRows = (equipmentResponse.data ?? []) as EquipmentRow[];
  const scopeCostRows = (scopeItemsResponse.data ?? []) as ProjectScopeCostRow[];

  const eligibleEstimates = estimates.filter((estimate) => RELEVANT_ESTIMATE_STATUSES.has(estimate.status.trim().toLowerCase()));
  const originalEstimateRow = eligibleEstimates[0] ?? null;
  const latestEstimateRow = eligibleEstimates.at(-1) ?? originalEstimateRow;

  const originalEstimate = toMoney(safeNumber(originalEstimateRow?.total_amount));
  const originalBudget = toMoney(
    safeNumber(project.estimated_cost)
      || safeNumber(originalEstimateRow?.internal_cost_total)
      || originalEstimate,
  );

  const approvedChangeOrders = toMoney(
    changeOrders
      .filter((changeOrder) => isApprovedChangeOrder(changeOrder.status))
      .reduce((sum, changeOrder) => sum + safeNumber(changeOrder.total_amount), 0),
  );

  const approvedChangeOrderCost = toMoney(
    approvedChangeOrderLineItems.reduce((sum, item) => sum + safeNumber(item.cost_amount), 0),
  );

  const workingScopeBudget = scopeCostRows.length > 0
    ? toMoney(scopeCostRows.reduce((sum, row) => sum + safeNumber(row.material_cost) + safeNumber(row.labor_cost), 0))
    : originalBudget;
  const revisedContractBase = safeNumber(project.contract_amount) || originalEstimate;
  const revisedContractValue = toMoney(revisedContractBase + approvedChangeOrders);
  const revisedBudget = toMoney(workingScopeBudget + approvedChangeOrderCost);

  const purchaseOrderStatusById = new Map(procurement.purchaseOrders.map((order) => [order.id, order.status.trim().toLowerCase()]));

  const committedMaterialCost = toMoney(
    procurement.purchaseOrderLines.reduce((sum, line) => {
      const status = purchaseOrderStatusById.get(line.purchase_order_id) || "draft";
      if (NON_COMMITTED_PURCHASE_ORDER_STATUSES.has(status)) {
        return sum;
      }

      const remainingQuantity = Math.max(0, safeNumber(line.quantity_ordered) - safeNumber(line.quantity_received) - safeNumber(line.quantity_damaged));
      return sum + remainingQuantity * safeNumber(line.unit_cost);
    }, 0),
  );

  const actualMaterialCost = toMoney(
    procurement.projectMaterialAllocations.reduce((sum, allocation) => sum + safeNumber(allocation.total_cost), 0),
  );

  const committedVendorCost = toMoney(
    tradePartners.reduce((sum, assignment) => {
      if (assignment.assignment_status === "archived" || assignment.contract_status === "cancelled") {
        return sum;
      }

      return sum + safeNumber(assignment.contract_amount);
    }, 0),
  );

  const retainage = toMoney(
    tradePartners.reduce((sum, assignment) => {
      if (assignment.assignment_status === "archived" || assignment.contract_status === "cancelled") {
        return sum;
      }

      const contractAmount = safeNumber(assignment.contract_amount);
      const retainagePercent = safeNumber(assignment.retainage_percent);
      return sum + contractAmount * (retainagePercent / 100);
    }, 0),
  );

  const committedCost = toMoney(committedMaterialCost + committedVendorCost);
  const actualCost = toMoney(actualMaterialCost);
  const remainingCostToComplete = toMoney(Math.max(revisedBudget - actualCost, 0));
  const forecastFinalCost = toMoney(Math.max(actualCost + committedCost, revisedBudget));

  const grossProfit = toMoney(revisedContractValue - forecastFinalCost);
  const grossMarginPercent = revisedContractValue > 0
    ? toMoney((grossProfit / revisedContractValue) * 100)
    : null;

  const amountInvoiced = toMoney(
    invoices.reduce((sum, invoice) => {
      if (normalizeInvoiceStatus(invoice.status) === "void") {
        return sum;
      }

      return sum + safeNumber(invoice.total_amount);
    }, 0),
  );

  const paymentsReceived = receivedPayments(invoices, payments);
  const outstandingReceivables = toMoney(Math.max(amountInvoiced - paymentsReceived, 0));
  const unbilledContractValue = toMoney(Math.max(revisedContractValue - amountInvoiced, 0));

  const categories = createBaseCategoryRows();

  if (scopeCostRows.length > 0) {
    categories.labor.budget = toMoney(scopeCostRows.reduce((sum, row) => sum + safeNumber(row.labor_cost), 0));
    categories.materials.budget = toMoney(scopeCostRows.reduce((sum, row) => sum + safeNumber(row.material_cost), 0));
    categories.labor.dataStatus = "partial";
    categories.labor.note = "Working scope labor budget; actual labor cost still requires linked timesheets and rates.";
  } else if (latestEstimateRow) {
    const lineItemsForLatestEstimate = estimateLineItems.filter((lineItem) => lineItem.estimate_id === latestEstimateRow.id);

    for (const lineItem of lineItemsForLatestEstimate) {
      const category = mapEstimateCategory(lineItem.category);
      const baseCost = safeNumber(lineItem.quantity) * safeNumber(lineItem.unit_cost);
      categories[category].budget = toMoney(categories[category].budget + baseCost);
      categories[category].dataStatus = "measured";
      categories[category].note = null;
    }
  }

  categories.other.budget = toMoney(categories.other.budget + approvedChangeOrderCost);
  categories.materials.committed = committedMaterialCost;
  categories.materials.actual = actualMaterialCost;
  categories.materials.forecast = toMoney(committedMaterialCost + actualMaterialCost);
  categories.materials.dataStatus = "measured";
  categories.materials.status = "on_track";
  categories.materials.note = null;

  categories.vendors.committed = committedVendorCost;
  categories.vendors.actual = 0;
  categories.vendors.forecast = committedVendorCost;

  const laborHours = toMoney(taskRows.reduce((sum, task) => sum + safeNumber(task.actual_hours), 0));

  categories.labor.committed = 0;
  categories.labor.actual = 0;
  categories.labor.forecast = categories.labor.budget;

  categories.equipment.committed = 0;
  categories.equipment.actual = 0;
  categories.equipment.forecast = categories.equipment.budget;

  for (const row of Object.values(categories)) {
    row.forecast = toMoney(Math.max(row.forecast, row.budget));

    row.varianceAmount = toMoney(row.budget - row.forecast);
    row.variancePercent = row.budget > 0 ? toMoney((row.varianceAmount / row.budget) * 100) : null;
    row.status = row.dataStatus === "unavailable" ? "unavailable" : deriveVarianceStatus(row.variancePercent);
  }

  const costCodeNameById = new Map(costCodes.map((code) => [code.id, code]));
  const costCodeAccumulator = new Map<string, { committed: number; actual: number }>();

  for (const line of procurement.purchaseOrderLines) {
    if (!line.cost_code_id) {
      continue;
    }

    const status = purchaseOrderStatusById.get(line.purchase_order_id) || "draft";
    if (NON_COMMITTED_PURCHASE_ORDER_STATUSES.has(status)) {
      continue;
    }

    const committed = Math.max(0, safeNumber(line.quantity_ordered) - safeNumber(line.quantity_received) - safeNumber(line.quantity_damaged)) * safeNumber(line.unit_cost);
    const existing = costCodeAccumulator.get(line.cost_code_id) || { committed: 0, actual: 0 };
    existing.committed += committed;
    costCodeAccumulator.set(line.cost_code_id, existing);
  }

  for (const allocation of procurement.projectMaterialAllocations) {
    if (!allocation.cost_code_id) {
      continue;
    }

    const existing = costCodeAccumulator.get(allocation.cost_code_id) || { committed: 0, actual: 0 };
    existing.actual += safeNumber(allocation.total_cost);
    costCodeAccumulator.set(allocation.cost_code_id, existing);
  }

  const costCodeVariance: CostCodeVarianceRow[] = Array.from(costCodeAccumulator.entries())
    .map(([costCodeId, values]) => {
      const codeRow = costCodeNameById.get(costCodeId);
      const budget = safeNumber(codeRow?.budget);
      const committed = toMoney(values.committed);
      const actual = toMoney(values.actual);
      const forecast = toMoney(committed + actual);
      const varianceAmount = toMoney(budget - forecast);
      const variancePercent = budget > 0 ? toMoney((varianceAmount / budget) * 100) : null;

      return {
        costCodeId,
        code: codeRow?.code || "--",
        name: codeRow?.name || "Unknown Cost Code",
        budget,
        committed,
        actual,
        forecast,
        varianceAmount,
        variancePercent,
        status: deriveVarianceStatus(variancePercent),
      };
    })
    .sort((left, right) => left.varianceAmount - right.varianceAmount);

  const draftInvoices = invoices.filter((invoice) => normalizeInvoiceStatus(invoice.status) === "draft").length;
  const sentInvoices = invoices.filter((invoice) => {
    const normalized = normalizeInvoiceStatus(invoice.status);
    return normalized === "sent" || normalized === "viewed" || normalized === "partially_paid" || normalized === "paid" || normalized === "overdue";
  }).length;
  const paidInvoices = invoices.filter((invoice) => normalizeInvoiceStatus(invoice.status) === "paid").length;
  const overdueInvoices = invoices.filter((invoice) => normalizeInvoiceStatus(invoice.status) === "overdue").length;

  const availability: DataAvailability[] = [
    {
      key: "labor_cost",
      label: "Labor Cost",
      status: "partial",
      detail: "Actual labor hours are available from tasks, but labor cost is unavailable until timesheets are linked to labor rates.",
    },
    {
      key: "equipment_usage_cost",
      label: "Equipment Usage Cost",
      status: "partial",
      detail: "Assigned equipment is available, but usage/rental/maintenance rollups are unavailable without project usage logs.",
    },
    {
      key: "procurement_tables_typing",
      label: "Procurement Typing",
      status: "partial",
      detail: "Procurement tables are queried from migration-backed schema; generated database types for those tables are currently stale.",
    },
  ];

  return {
    summary: {
      projectId: project.id,
      projectName: project.name,
      originalEstimate,
      approvedChangeOrders,
      approvedChangeOrderCost,
      revisedContractValue,
      originalBudget,
      revisedBudget,
      committedCost,
      actualCost,
      remainingCostToComplete,
      forecastFinalCost,
      grossProfit,
      grossMarginPercent,
      amountInvoiced,
      paymentsReceived,
      outstandingReceivables,
      retainage,
      unbilledContractValue,
      metricSources: {
        originalEstimate: ["estimates.total_amount"],
        approvedChangeOrders: ["change_orders.total_amount"],
        approvedChangeOrderCost: ["change_order_line_items.cost_amount"],
        revisedContractValue: ["projects.contract_amount", "change_orders.total_amount", "derived"],
        originalBudget: ["projects.estimated_cost", "estimates.internal_cost_total", "derived"],
        revisedBudget: scopeCostRows.length > 0
          ? ["project_scope_items", "change_order_line_items.cost_amount", "derived"]
          : ["estimates.internal_cost_total", "change_order_line_items.cost_amount", "derived"],
        committedCost: ["purchase_order_line_items", "trade_partner_assignments", "derived"],
        actualCost: ["project_material_allocations", "derived"],
        amountInvoiced: ["invoices.total_amount"],
        paymentsReceived: ["invoice_payment_history.amount", "invoices.amount_paid", "derived"],
        outstandingReceivables: ["invoices.total_amount", "invoice_payment_history.amount", "derived"],
        retainage: ["trade_partner_assignments", "derived"],
        unbilledContractValue: ["projects.contract_amount", "invoices.total_amount", "derived"],
      },
    },
    jobCostByCategory: Object.values(categories),
    costCodeVariance,
    labor: {
      employeeHours: laborHours,
      crewHours: null,
      regularLaborCost: null,
      overtimeCost: null,
      totalLaborCost: null,
      source: ["tasks.actual_hours"],
      note: "Labor cost requires timesheets linked to labor rates; only project task hours are currently available.",
    },
    materials: {
      requestCount: procurement.materialRequests.length,
      purchaseOrderCount: procurement.purchaseOrders.length,
      committedMaterialCost,
      actualMaterialCost,
      outstandingMaterialCommitments: committedMaterialCost,
      source: ["purchase_orders", "purchase_order_line_items", "project_material_allocations"],
    },
    equipment: {
      assignedEquipmentCount: equipmentRows.length,
      usageCost: null,
      rentalCost: null,
      maintenanceCost: null,
      source: ["equipment"],
      note: "Equipment cost rollups require usage logs per project; assignment inventory is currently available.",
    },
    vendors: {
      activeVendorAssignments: tradePartners.filter((assignment) => assignment.assignment_status === "active").length,
      committedVendorCost,
      actualVendorCost: null,
      source: ["trade_partner_assignments"],
      note: "Vendor actual cost is unavailable until vendor payables or progress billing is captured in project financial logs.",
    },
    billing: {
      draftInvoices,
      sentInvoices,
      paidInvoices,
      overdueInvoices,
      totalInvoiced: amountInvoiced,
      totalCollected: paymentsReceived,
      outstandingBalance: outstandingReceivables,
      retainage,
      unbilledContractAmount: unbilledContractValue,
      source: ["invoices.total_amount", "invoice_payment_history.amount", "trade_partner_assignments"],
    },
    availability,
  };
}

export async function buildCompanyFinancialReport(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  marginTargetPercent?: number;
}): Promise<CompanyFinancialReport> {
  const marginTargetPercent = params.marginTargetPercent ?? 15;

  const [projectsResponse, estimatesResponse, changeOrdersResponse, invoicesResponse, paymentsResponse, tradePartnersResponse] = await Promise.all([
    readAllSupabaseRows((from, to) => params.supabase
      .from("projects")
      .select("id, name, status, contract_amount, estimated_cost")
      .eq("company_id", params.companyId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => params.supabase
      .from("estimates")
      .select("id, project_id, status, total_amount, internal_cost_total, created_at")
      .eq("company_id", params.companyId)
      .not("project_id", "is", null).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => params.supabase
      .from("change_orders")
      .select("id, project_id, status, total_amount")
      .eq("company_id", params.companyId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => params.supabase
      .from("invoices")
      .select("id, project_id, status, total_amount, amount_paid, company_id")
      .eq("company_id", params.companyId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => params.supabase
      .from("invoice_payment_history")
      .select("invoice_id, amount, status")
      .eq("company_id", params.companyId).order("id", { ascending: true }).range(from, to)),
    readAllSupabaseRows((from, to) => params.supabase
      .from("trade_partner_assignments")
      .select("id, project_id, assignment_status, contract_status, contract_amount, retainage_percent")
      .eq("company_id", params.companyId).order("id", { ascending: true }).range(from, to)),
  ]);

  if (projectsResponse.error) {
    throw new Error(projectsResponse.error.message);
  }
  if (estimatesResponse.error) {
    throw new Error(estimatesResponse.error.message);
  }
  if (changeOrdersResponse.error) {
    throw new Error(changeOrdersResponse.error.message);
  }
  if (invoicesResponse.error) {
    throw new Error(invoicesResponse.error.message);
  }
  if (paymentsResponse.error) {
    throw new Error(paymentsResponse.error.message);
  }
  if (tradePartnersResponse.error) {
    throw new Error(tradePartnersResponse.error.message);
  }

  const projects = (projectsResponse.data ?? []) as ProjectRow[];
  const estimates = (estimatesResponse.data ?? []) as EstimateRow[];
  const changeOrders = (changeOrdersResponse.data ?? []) as ChangeOrderRow[];
  const invoices = (invoicesResponse.data ?? []) as InvoiceRow[];
  const payments = (paymentsResponse.data ?? []) as InvoicePaymentRow[];
  const tradePartners = (tradePartnersResponse.data ?? []) as TradePartnerAssignmentRow[];

  const estimatesByProject = new Map<string, EstimateRow[]>();
  for (const estimate of estimates) {
    if (!estimate.project_id) {
      continue;
    }

    const rows = estimatesByProject.get(estimate.project_id) || [];
    rows.push(estimate);
    estimatesByProject.set(estimate.project_id, rows);
  }

  const invoicesByProject = new Map<string, InvoiceRow[]>();
  for (const invoice of invoices) {
    if (!invoice.project_id) {
      continue;
    }

    const rows = invoicesByProject.get(invoice.project_id) || [];
    rows.push(invoice);
    invoicesByProject.set(invoice.project_id, rows);
  }

  const approvedChangeOrdersByProject = new Map<string, number>();
  for (const changeOrder of changeOrders) {
    if (!changeOrder.project_id || !isApprovedChangeOrder(changeOrder.status)) {
      continue;
    }

    approvedChangeOrdersByProject.set(
      changeOrder.project_id,
      safeNumber(approvedChangeOrdersByProject.get(changeOrder.project_id)) + safeNumber(changeOrder.total_amount),
    );
  }

  let totalBacklog = 0;
  let revisedContractTotal = 0;
  const projectCosts = await loadCompanyProjectCosts({ ...params, changeOrders });
  let forecastCostTotal = 0;
  let companyCommittedCost = 0;
  let companyActualCost = 0;
  let jobsOverBudget = 0;
  let jobsUnderMarginTarget = 0;

  const vendorCommitments = new Map<string, number>();
  for (const assignment of tradePartners) {
    if (!assignment.project_id || assignment.assignment_status === "archived" || assignment.contract_status === "cancelled") continue;
    vendorCommitments.set(assignment.project_id, (vendorCommitments.get(assignment.project_id) ?? 0) + safeNumber(assignment.contract_amount));
  }

  for (const project of projects) {
    const projectEstimates = (estimatesByProject.get(project.id) || [])
      .filter((estimate) => RELEVANT_ESTIMATE_STATUSES.has(estimate.status.trim().toLowerCase()))
      .sort((left, right) => left.created_at.localeCompare(right.created_at));

    const firstEstimate = projectEstimates[0] ?? null;
    const baselineBudget = safeNumber(project.estimated_cost) || safeNumber(firstEstimate?.internal_cost_total) || safeNumber(firstEstimate?.total_amount);
    const costs = projectCosts.get(project.id);
    const revisedBudget = toMoney(toMoney(costs?.scopeBudget ?? baselineBudget) + toMoney(costs?.changeOrderCost ?? 0));
    const vendorCommitted = toMoney(vendorCommitments.get(project.id) ?? 0);
    const projectCommitted = toMoney(toMoney(costs?.committedMaterials ?? 0) + vendorCommitted);
    const projectActual = toMoney(costs?.actual ?? 0);
    const forecast = toMoney(Math.max(projectActual + projectCommitted, revisedBudget));
    const originalEstimate = safeNumber(firstEstimate?.total_amount);
    const revisedContract = (safeNumber(project.contract_amount) || originalEstimate) + safeNumber(approvedChangeOrdersByProject.get(project.id));
    const projectInvoiced = (invoicesByProject.get(project.id) || []).reduce((sum, invoice) => {
      if (normalizeInvoiceStatus(invoice.status) === "void") {
        return sum;
      }

      return sum + safeNumber(invoice.total_amount);
    }, 0);

    revisedContractTotal += revisedContract;
    forecastCostTotal += forecast;
    companyCommittedCost += projectCommitted;
    companyActualCost += projectActual;

    if (ACTIVE_PROJECT_STATUSES.has(project.status.trim().toLowerCase())) {
      totalBacklog += Math.max(revisedContract - projectInvoiced, 0);
    }

    if (forecast > revisedBudget) {
      jobsOverBudget += 1;
    }

    if (revisedContract > 0) {
      const marginPercent = ((revisedContract - forecast) / revisedContract) * 100;
      if (marginPercent < marginTargetPercent) {
        jobsUnderMarginTarget += 1;
      }
    }
  }

  const totalInvoiced = invoices.reduce((sum, invoice) => {
    if (normalizeInvoiceStatus(invoice.status) === "void") {
      return sum;
    }

    return sum + safeNumber(invoice.total_amount);
  }, 0);

  const companyRevenue = receivedPayments(invoices, payments);

  const totalOutstandingReceivables = toMoney(Math.max(totalInvoiced - companyRevenue, 0));
  const committedCost = toMoney(companyCommittedCost);
  const actualCost = toMoney(companyActualCost);
  const projectGrossProfit = toMoney(revisedContractTotal - forecastCostTotal);
  const projectMarginPercent = revisedContractTotal > 0
    ? toMoney((projectGrossProfit / revisedContractTotal) * 100)
    : null;
  const cashExposure = toMoney(totalOutstandingReceivables + Math.max(committedCost - actualCost, 0));

  const availability: DataAvailability[] = [
    {
      key: "company_committed_actual",
      label: "Company Committed vs Actual Cost",
      status: "partial",
      detail: "Totals use project procurement commitments, active trade partner contracts, approved receipts, and approved non-PO vendor bill costs. Company cost-code rollups are excluded to avoid counting project costs twice.",
    },
    {
      key: "project_margin_baseline",
      label: "Project Forecast Margin",
      status: "partial",
      detail: "Forecast margins use current working scope plus approved internal change-order costs, with actual plus committed cost as a floor, matching project reports. Labor and equipment actual-cost capture remains partial.",
    },
  ];

  return {
    summary: {
      companyRevenue,
      totalBacklog: toMoney(totalBacklog),
      totalOutstandingReceivables,
      committedCost,
      projectGrossProfit,
      projectMarginPercent,
      jobsOverBudget,
      jobsUnderMarginTarget,
      cashExposure,
      source: [
        "projects.contract_amount",
        "projects.estimated_cost",
        "estimates.total_amount",
        "change_orders.total_amount",
        "invoices.total_amount",
        "invoice_payment_history.amount",
        "project_scope_items",
        "change_order_line_items.cost_amount",
        "purchase_orders",
        "purchase_order_line_items",
        "project_material_allocations",
        "project_receipts",
        "vendor_bills",
        "vendor_bill_line_items",
        "trade_partner_assignments",
        "derived",
      ],
    },
    projectsReviewed: projects.length,
    marginTargetPercent,
    availability,
  };
}
