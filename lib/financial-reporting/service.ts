import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import type { Database } from "@/types/database.types";
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

type TaskRow = Pick<Database["public"]["Tables"]["tasks"]["Row"], "actual_hours">;
type EquipmentRow = Pick<Database["public"]["Tables"]["equipment"]["Row"], "id" | "daily_internal_cost" | "rental_daily_cost" | "maintenance_cost_per_hour">;

type PurchaseOrderRow = { id: string; project_id: string; vendor_id: string; status: string; total_amount: number; cost_code_id: string | null };
type PurchaseOrderLineItemRow = { id: string; purchase_order_id: string; project_id: string; cost_code_id: string | null; quantity_ordered: number; quantity_received: number; quantity_damaged: number; unit_cost: number };
type ProjectMaterialAllocationRow = { project_id: string; cost_code_id: string | null; total_cost: number };
type MaterialRequestRow = { id: string };
type VendorBillRow = { id: string; status: string; total_amount: number; amount_paid: number };
type VendorBillLineRow = { vendor_bill_id: string; project_id: string | null; cost_code_id: string | null; category: string; line_amount: number };
type PrevailingWageTimeRow = { regular_hours: number; overtime_hours: number; doubletime_hours: number; actual_base_rate: number; actual_cash_fringe: number; actual_bona_fide_fringe: number };

type QueryableSupabase = SupabaseClient<Database> & { from: (table: string) => any };

const APPROVED_CHANGE_ORDER_STATUSES = new Set(["approved", "invoiced"]);
const TERMINAL_PURCHASE_ORDER_STATUSES = new Set(["cancelled", "fully_received"]);
const RELEVANT_ESTIMATE_STATUSES = new Set(["draft", "internal_review", "sent", "viewed", "approved", "ready", "revision_requested"]);

function toMoney(value: number) { return Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0; }
function safeNumber(value: number | null | undefined) { return typeof value === "number" && Number.isFinite(value) ? value : 0; }
function isApprovedChangeOrder(status: string) { return APPROVED_CHANGE_ORDER_STATUSES.has(normalizeChangeOrderStatus(status)); }
function deriveVarianceStatus(variancePercent: number | null): "on_track" | "at_risk" | "over_budget" {
  if (variancePercent === null) return "on_track";
  if (variancePercent < 0) return "over_budget";
  if (variancePercent <= 10) return "at_risk";
  return "on_track";
}
function mapEstimateCategory(category: string): JobCostCategoryKey {
  const normalized = category.trim().toLowerCase();
  if (normalized === "labor") return "labor";
  if (normalized === "materials") return "materials";
  if (normalized === "equipment") return "equipment";
  if (normalized === "subcontractors") return "vendors";
  return "other";
}
function mapVendorBillCategory(category: string): JobCostCategoryKey {
  const normalized = category.trim().toLowerCase();
  if (normalized === "materials") return "materials";
  if (normalized === "subcontractor" || normalized === "professional_service") return "vendors";
  if (normalized === "equipment" || normalized === "rental") return "equipment";
  return "other";
}

function createBaseCategoryRows(): Record<JobCostCategoryKey, JobCostCategoryRow> {
  return {
    labor: { category: "labor", budget: 0, committed: 0, actual: 0, forecast: 0, varianceAmount: 0, variancePercent: null, status: "unavailable", dataStatus: "unavailable", note: "Labor cost is unavailable until timesheets are linked to labor rates." },
    materials: { category: "materials", budget: 0, committed: 0, actual: 0, forecast: 0, varianceAmount: 0, variancePercent: null, status: "unavailable", dataStatus: "unavailable", note: "" },
    equipment: { category: "equipment", budget: 0, committed: 0, actual: 0, forecast: 0, varianceAmount: 0, variancePercent: null, status: "unavailable", dataStatus: "unavailable", note: "Equipment usage cost is unavailable until usage hours are captured." },
    vendors: { category: "vendors", budget: 0, committed: 0, actual: 0, forecast: 0, varianceAmount: 0, variancePercent: null, status: "unavailable", dataStatus: "partial", note: "Committed vendor cost is available from trade partner contracts." },
    other: { category: "other", budget: 0, committed: 0, actual: 0, forecast: 0, varianceAmount: 0, variancePercent: null, status: "unavailable", dataStatus: "partial", note: "Other costs are currently budget-driven." },
  };
}

async function loadProcurementRows(supabase: QueryableSupabase, companyId: string, projectId: string) {
  const [purchaseOrdersResponse, purchaseOrderLinesResponse, allocationsResponse, requestsResponse] = await Promise.all([
    supabase.from("purchase_orders").select("id, project_id, vendor_id, status, total_amount, cost_code_id").eq("company_id", companyId).eq("project_id", projectId),
    supabase.from("purchase_order_line_items").select("id, purchase_order_id, project_id, cost_code_id, quantity_ordered, quantity_received, quantity_damaged, unit_cost").eq("company_id", companyId).eq("project_id", projectId),
    supabase.from("project_material_allocations").select("project_id, cost_code_id, total_cost").eq("company_id", companyId).eq("project_id", projectId),
    supabase.from("material_requests").select("id").eq("company_id", companyId).eq("project_id", projectId),
  ]);
  for (const response of [purchaseOrdersResponse, purchaseOrderLinesResponse, allocationsResponse, requestsResponse]) {
    if (response.error) throw new Error(response.error.message);
  }
  return {
    purchaseOrders: (purchaseOrdersResponse.data ?? []) as PurchaseOrderRow[],
    purchaseOrderLines: (purchaseOrderLinesResponse.data ?? []) as PurchaseOrderLineItemRow[],
    projectMaterialAllocations: (allocationsResponse.data ?? []) as ProjectMaterialAllocationRow[],
    materialRequests: (requestsResponse.data ?? []) as MaterialRequestRow[],
  };
}

async function loadActualCostRows(supabase: QueryableSupabase, companyId: string, projectId: string) {
  const [billsResponse, billLinesResponse, prevailingWageResponse] = await Promise.all([
    supabase.from("vendor_bills").select("id, status, total_amount, amount_paid").eq("company_id", companyId).eq("project_id", projectId),
    supabase.from("vendor_bill_line_items").select("vendor_bill_id, project_id, cost_code_id, category, line_amount").eq("company_id", companyId).eq("project_id", projectId),
    supabase.from("prevailing_wage_time_entries").select("regular_hours, overtime_hours, doubletime_hours, actual_base_rate, actual_cash_fringe, actual_bona_fide_fringe").eq("company_id", companyId).eq("project_id", projectId),
  ]);
  for (const response of [billsResponse, billLinesResponse, prevailingWageResponse]) {
    if (response.error) throw new Error(response.error.message);
  }
  return {
    vendorBills: (billsResponse.data ?? []) as VendorBillRow[],
    vendorBillLines: (billLinesResponse.data ?? []) as VendorBillLineRow[],
    prevailingWageTime: (prevailingWageResponse.data ?? []) as PrevailingWageTimeRow[],
  };
}

export async function buildProjectFinancialReport(params: { supabase: SupabaseClient<Database>; companyId: string; projectId: string }): Promise<ProjectFinancialReport> {
  const supabase = params.supabase;
  const queryable = supabase as QueryableSupabase;
  const projectResponse = await supabase.from("projects").select("id, name, status, contract_amount, estimated_cost").eq("company_id", params.companyId).eq("id", params.projectId).maybeSingle<ProjectRow>();
  if (projectResponse.error) throw new Error(projectResponse.error.message);
  if (!projectResponse.data) throw new Error("Project not found.");
  const project = projectResponse.data;

  const [estimatesResponse, changeOrdersResponse, invoicesResponse, costCodesResponse, tradePartnersResponse, tasksResponse, equipmentResponse, procurement, actualRows] = await Promise.all([
    supabase.from("estimates").select("id, project_id, status, total_amount, internal_cost_total, created_at").eq("company_id", params.companyId).eq("project_id", params.projectId).order("created_at", { ascending: true }),
    supabase.from("change_orders").select("id, project_id, status, total_amount").eq("company_id", params.companyId).eq("project_id", params.projectId),
    supabase.from("invoices").select("id, project_id, status, total_amount, amount_paid, company_id").eq("company_id", params.companyId).eq("project_id", params.projectId),
    supabase.from("cost_codes").select("id, code, name, budget, committed_cost, actual_cost").eq("company_id", params.companyId),
    supabase.from("trade_partner_assignments").select("id, project_id, assignment_status, contract_status, contract_amount, retainage_percent").eq("company_id", params.companyId).eq("project_id", params.projectId),
    supabase.from("tasks").select("actual_hours").eq("company_id", params.companyId).eq("project_id", params.projectId),
    supabase.from("equipment").select("id, daily_internal_cost, rental_daily_cost, maintenance_cost_per_hour").eq("company_id", params.companyId).eq("assigned_job_id", params.projectId),
    loadProcurementRows(queryable, params.companyId, params.projectId),
    loadActualCostRows(queryable, params.companyId, params.projectId),
  ]);
  for (const response of [estimatesResponse, changeOrdersResponse, invoicesResponse, costCodesResponse, tradePartnersResponse, tasksResponse, equipmentResponse]) {
    if (response.error) throw new Error(response.error.message);
  }

  const estimates = (estimatesResponse.data ?? []) as EstimateRow[];
  const estimateIds = estimates.map((estimate) => estimate.id);
  const estimateLineItemsResponse = estimateIds.length > 0 ? await supabase.from("estimate_line_items").select("estimate_id, category, quantity, unit_cost").eq("company_id", params.companyId).in("estimate_id", estimateIds) : { data: [], error: null };
  if (estimateLineItemsResponse.error) throw new Error(estimateLineItemsResponse.error.message);

  const changeOrders = (changeOrdersResponse.data ?? []) as ChangeOrderRow[];
  const approvedChangeOrderIds = changeOrders.filter((changeOrder) => isApprovedChangeOrder(changeOrder.status)).map((changeOrder) => changeOrder.id);
  const changeOrderLineItemsResponse = approvedChangeOrderIds.length > 0 ? await supabase.from("change_order_line_items").select("change_order_id, cost_amount").eq("company_id", params.companyId).in("change_order_id", approvedChangeOrderIds) : { data: [], error: null };
  if (changeOrderLineItemsResponse.error) throw new Error(changeOrderLineItemsResponse.error.message);

  const invoices = (invoicesResponse.data ?? []) as InvoiceRow[];
  const invoiceIds = invoices.map((invoice) => invoice.id);
  const paymentResponse = invoiceIds.length > 0 ? await supabase.from("invoice_payment_history").select("invoice_id, amount, status").eq("company_id", params.companyId).in("invoice_id", invoiceIds) : { data: [], error: null };
  if (paymentResponse.error) throw new Error(paymentResponse.error.message);

  const estimateLineItems = (estimateLineItemsResponse.data ?? []) as EstimateLineItemRow[];
  const approvedChangeOrderLineItems = (changeOrderLineItemsResponse.data ?? []) as ChangeOrderLineItemRow[];
  const payments = (paymentResponse.data ?? []) as InvoicePaymentRow[];
  const costCodes = (costCodesResponse.data ?? []) as CostCodeRow[];
  const tradePartners = (tradePartnersResponse.data ?? []) as TradePartnerAssignmentRow[];
  const taskRows = (tasksResponse.data ?? []) as TaskRow[];
  const equipmentRows = (equipmentResponse.data ?? []) as EquipmentRow[];

  const eligibleEstimates = estimates.filter((estimate) => RELEVANT_ESTIMATE_STATUSES.has(estimate.status.trim().toLowerCase()));
  const originalEstimateRow = eligibleEstimates[0] ?? null;
  const latestEstimateRow = eligibleEstimates.at(-1) ?? originalEstimateRow;
  const originalEstimate = toMoney(safeNumber(originalEstimateRow?.total_amount));
  const originalBudget = toMoney(safeNumber(project.estimated_cost) || safeNumber(originalEstimateRow?.internal_cost_total) || originalEstimate);
  const approvedChangeOrders = toMoney(changeOrders.filter((changeOrder) => isApprovedChangeOrder(changeOrder.status)).reduce((sum, changeOrder) => sum + safeNumber(changeOrder.total_amount), 0));
  const approvedChangeOrderCost = toMoney(approvedChangeOrderLineItems.reduce((sum, item) => sum + safeNumber(item.cost_amount), 0));
  const revisedContractBase = safeNumber(project.contract_amount) || originalEstimate;
  const revisedContractValue = toMoney(revisedContractBase + approvedChangeOrders);
  const revisedBudget = toMoney(originalBudget + approvedChangeOrderCost);

  const purchaseOrderStatusById = new Map(procurement.purchaseOrders.map((order) => [order.id, order.status.trim().toLowerCase()]));
  const committedMaterialCost = toMoney(procurement.purchaseOrderLines.reduce((sum, line) => {
    const status = purchaseOrderStatusById.get(line.purchase_order_id) || "draft";
    if (TERMINAL_PURCHASE_ORDER_STATUSES.has(status)) return sum;
    const remainingQuantity = Math.max(0, safeNumber(line.quantity_ordered) - safeNumber(line.quantity_received) - safeNumber(line.quantity_damaged));
    return sum + remainingQuantity * safeNumber(line.unit_cost);
  }, 0));
  const actualMaterialCostFromAllocations = toMoney(procurement.projectMaterialAllocations.reduce((sum, allocation) => sum + safeNumber(allocation.total_cost), 0));
  const payableBillIds = new Set(actualRows.vendorBills.filter((bill) => ["approved", "partially_paid", "paid"].includes(bill.status)).map((bill) => bill.id));
  const billActuals: Record<JobCostCategoryKey, number> = { labor: 0, materials: 0, equipment: 0, vendors: 0, other: 0 };
  for (const line of actualRows.vendorBillLines) {
    if (!payableBillIds.has(line.vendor_bill_id)) continue;
    billActuals[mapVendorBillCategory(line.category)] += safeNumber(line.line_amount);
  }
  const actualMaterialCost = toMoney(actualMaterialCostFromAllocations + billActuals.materials);
  const committedVendorCost = toMoney(tradePartners.reduce((sum, assignment) => assignment.assignment_status === "archived" || assignment.contract_status === "cancelled" ? sum : sum + safeNumber(assignment.contract_amount), 0));
  const retainage = toMoney(tradePartners.reduce((sum, assignment) => assignment.assignment_status === "archived" || assignment.contract_status === "cancelled" ? sum : sum + safeNumber(assignment.contract_amount) * (safeNumber(assignment.retainage_percent) / 100), 0));

  const prevailingWageLaborCost = toMoney(actualRows.prevailingWageTime.reduce((sum, row) => {
    const hourly = safeNumber(row.actual_base_rate) + safeNumber(row.actual_cash_fringe) + safeNumber(row.actual_bona_fide_fringe);
    return sum + hourly * (safeNumber(row.regular_hours) + safeNumber(row.overtime_hours) + safeNumber(row.doubletime_hours));
  }, 0));
  const totalActualVendorCost = toMoney(billActuals.vendors);
  const totalActualEquipmentCost = toMoney(billActuals.equipment);
  const totalActualOtherCost = toMoney(billActuals.other);
  const actualCost = toMoney(actualMaterialCost + prevailingWageLaborCost + totalActualVendorCost + totalActualEquipmentCost + totalActualOtherCost);
  const committedCost = toMoney(committedMaterialCost + committedVendorCost);
  const remainingCostToComplete = toMoney(Math.max(revisedBudget - actualCost, 0));
  const forecastFinalCost = toMoney(Math.max(actualCost + committedCost, revisedBudget));
  const grossProfit = toMoney(revisedContractValue - forecastFinalCost);
  const grossMarginPercent = revisedContractValue > 0 ? toMoney((grossProfit / revisedContractValue) * 100) : null;

  const amountInvoiced = toMoney(invoices.reduce((sum, invoice) => normalizeInvoiceStatus(invoice.status) === "void" ? sum : sum + safeNumber(invoice.total_amount), 0));
  const paymentsReceivedFromHistory = toMoney(payments.reduce((sum, payment) => payment.status.trim().toLowerCase() === "recorded" ? sum + safeNumber(payment.amount) : sum, 0));
  const fallbackAmountPaid = toMoney(invoices.reduce((sum, invoice) => sum + safeNumber(invoice.amount_paid), 0));
  const paymentsReceived = payments.length > 0 ? paymentsReceivedFromHistory : fallbackAmountPaid;
  const outstandingReceivables = toMoney(Math.max(amountInvoiced - paymentsReceived, 0));
  const unbilledContractValue = toMoney(Math.max(revisedContractValue - amountInvoiced, 0));

  const categories = createBaseCategoryRows();
  if (latestEstimateRow) {
    for (const lineItem of estimateLineItems.filter((lineItem) => lineItem.estimate_id === latestEstimateRow.id)) {
      const category = mapEstimateCategory(lineItem.category);
      categories[category].budget = toMoney(categories[category].budget + safeNumber(lineItem.quantity) * safeNumber(lineItem.unit_cost));
      categories[category].dataStatus = "measured";
      categories[category].note = null;
    }
  }
  categories.other.budget = toMoney(categories.other.budget + approvedChangeOrderCost);
  categories.materials.committed = committedMaterialCost;
  categories.materials.actual = actualMaterialCost;
  categories.materials.forecast = toMoney(committedMaterialCost + actualMaterialCost);
  categories.materials.dataStatus = "measured";
  categories.materials.note = null;
  categories.vendors.committed = committedVendorCost;
  categories.vendors.actual = totalActualVendorCost;
  categories.vendors.forecast = toMoney(Math.max(committedVendorCost, totalActualVendorCost));
  categories.vendors.dataStatus = "measured";
  categories.vendors.note = "Actual vendor cost includes approved and paid vendor bills.";
  categories.labor.actual = prevailingWageLaborCost;
  categories.labor.forecast = Math.max(categories.labor.budget, prevailingWageLaborCost);
  categories.labor.dataStatus = actualRows.prevailingWageTime.length > 0 ? "measured" : "unavailable";
  categories.labor.note = actualRows.prevailingWageTime.length > 0 ? "Labor actuals include prevailing-wage time, base pay, cash fringe, and bona fide fringe credits." : categories.labor.note;
  categories.equipment.actual = totalActualEquipmentCost;
  categories.equipment.forecast = Math.max(categories.equipment.budget, totalActualEquipmentCost);
  if (totalActualEquipmentCost > 0) { categories.equipment.dataStatus = "measured"; categories.equipment.note = "Actual equipment cost includes approved and paid vendor bills."; }
  categories.other.actual = totalActualOtherCost;
  categories.other.forecast = Math.max(categories.other.budget, totalActualOtherCost);
  if (totalActualOtherCost > 0) categories.other.dataStatus = "measured";

  for (const row of Object.values(categories)) {
    if (row.forecast === 0) row.forecast = row.budget;
    row.varianceAmount = toMoney(row.budget - row.forecast);
    row.variancePercent = row.budget > 0 ? toMoney((row.varianceAmount / row.budget) * 100) : null;
    row.status = row.dataStatus === "unavailable" ? "unavailable" : deriveVarianceStatus(row.variancePercent);
  }

  const costCodeNameById = new Map(costCodes.map((code) => [code.id, code]));
  const costCodeAccumulator = new Map<string, { committed: number; actual: number }>();
  for (const line of procurement.purchaseOrderLines) {
    if (!line.cost_code_id) continue;
    const status = purchaseOrderStatusById.get(line.purchase_order_id) || "draft";
    if (TERMINAL_PURCHASE_ORDER_STATUSES.has(status)) continue;
    const committed = Math.max(0, safeNumber(line.quantity_ordered) - safeNumber(line.quantity_received) - safeNumber(line.quantity_damaged)) * safeNumber(line.unit_cost);
    const existing = costCodeAccumulator.get(line.cost_code_id) || { committed: 0, actual: 0 };
    existing.committed += committed;
    costCodeAccumulator.set(line.cost_code_id, existing);
  }
  for (const allocation of procurement.projectMaterialAllocations) {
    if (!allocation.cost_code_id) continue;
    const existing = costCodeAccumulator.get(allocation.cost_code_id) || { committed: 0, actual: 0 };
    existing.actual += safeNumber(allocation.total_cost);
    costCodeAccumulator.set(allocation.cost_code_id, existing);
  }
  for (const line of actualRows.vendorBillLines) {
    if (!line.cost_code_id || !payableBillIds.has(line.vendor_bill_id)) continue;
    const existing = costCodeAccumulator.get(line.cost_code_id) || { committed: 0, actual: 0 };
    existing.actual += safeNumber(line.line_amount);
    costCodeAccumulator.set(line.cost_code_id, existing);
  }

  const costCodeVariance: CostCodeVarianceRow[] = costCodes.map((code) => {
    const dynamic = costCodeAccumulator.get(code.id) || { committed: 0, actual: 0 };
    const budget = toMoney(safeNumber(code.budget));
    const committed = toMoney(Math.max(safeNumber(code.committed_cost), dynamic.committed));
    const actual = toMoney(Math.max(safeNumber(code.actual_cost), dynamic.actual));
    const forecast = toMoney(Math.max(actual + committed, budget));
    const varianceAmount = toMoney(budget - forecast);
    const variancePercent = budget > 0 ? toMoney((varianceAmount / budget) * 100) : null;
    return { costCodeId: code.id, code: code.code, name: code.name, budget, committed, actual, forecast, varianceAmount, variancePercent, status: deriveVarianceStatus(variancePercent) };
  }).filter((row) => row.budget > 0 || row.committed > 0 || row.actual > 0);

  const laborHours = toMoney(taskRows.reduce((sum, task) => sum + safeNumber(task.actual_hours), 0));
  const availability: DataAvailability[] = [
    { key: "revenue", label: "Contract / revenue", status: revisedContractValue > 0 ? "available" : "partial", detail: "Uses project contract amount, estimate totals, and approved change orders." },
    { key: "ar", label: "Accounts receivable", status: "available", detail: "Uses invoices and recorded invoice payments." },
    { key: "ap", label: "Accounts payable", status: actualRows.vendorBills.length > 0 ? "available" : "partial", detail: "Uses approved/paid vendor bills and vendor bill line items." },
    { key: "materials", label: "Material cost", status: "available", detail: "Uses purchase orders, received project material allocations, and approved vendor bills." },
    { key: "labor", label: "Labor cost", status: actualRows.prevailingWageTime.length > 0 ? "available" : "partial", detail: actualRows.prevailingWageTime.length > 0 ? "Uses prevailing-wage time entries with base and fringe compensation." : "Hours are available, but complete payroll-linked labor cost is still partial." },
    { key: "equipment", label: "Equipment cost", status: totalActualEquipmentCost > 0 ? "partial" : "unavailable", detail: "Vendor-billed equipment cost is included; internal usage-hour costing remains incomplete." },
    { key: "vendors", label: "Vendor / subcontractor cost", status: "available", detail: "Uses trade partner commitments and approved/paid vendor bills for actuals." },
  ];

  return {
    summary: { projectId: project.id, projectName: project.name, originalEstimate, approvedChangeOrders, revisedContractValue, originalBudget, revisedBudget, committedCost, actualCost, remainingCostToComplete, forecastFinalCost, grossProfit, grossMarginPercent, amountInvoiced, paymentsReceived, outstandingReceivables, retainage, unbilledContractValue, metricSources: {
      originalEstimate: ["estimates.total_amount"], revisedContractValue: ["projects.contract_amount", "change_orders.total_amount"], originalBudget: ["projects.estimated_cost", "estimates.internal_cost_total"], revisedBudget: ["change_order_line_items.cost_amount"], committedCost: ["purchase_orders", "purchase_order_line_items", "trade_partner_assignments"], actualCost: ["project_material_allocations", "derived"], amountInvoiced: ["invoices.total_amount"], paymentsReceived: ["invoice_payment_history.amount", "invoices.amount_paid"],
    } },
    jobCostByCategory: Object.values(categories),
    costCodeVariance,
    labor: { employeeHours: laborHours || null, crewHours: null, regularLaborCost: prevailingWageLaborCost || null, overtimeCost: null, totalLaborCost: prevailingWageLaborCost || null, source: actualRows.prevailingWageTime.length > 0 ? ["derived"] : ["tasks.actual_hours"], note: actualRows.prevailingWageTime.length > 0 ? "Prevailing-wage labor actuals include required compensation components captured in time entries." : "Task hours exist; payroll-linked labor cost remains partial." },
    materials: { requestCount: procurement.materialRequests.length, purchaseOrderCount: procurement.purchaseOrders.length, committedMaterialCost, actualMaterialCost, outstandingMaterialCommitments: committedMaterialCost, source: ["purchase_orders", "purchase_order_line_items", "project_material_allocations", "derived"] },
    equipment: { assignedEquipmentCount: equipmentRows.length, usageCost: null, rentalCost: totalActualEquipmentCost || null, maintenanceCost: null, source: totalActualEquipmentCost > 0 ? ["derived"] : ["equipment"], note: totalActualEquipmentCost > 0 ? "Vendor-billed equipment/rental actuals are included; internal usage costing is still partial." : "Equipment is assigned, but usage hours are not yet costed." },
    vendors: { activeVendorAssignments: tradePartners.filter((item) => item.assignment_status !== "archived").length, committedVendorCost, actualVendorCost: totalActualVendorCost || null, source: ["trade_partner_assignments", "derived"], note: "Committed vendor cost comes from trade partner assignments; actual vendor cost comes from approved/paid vendor bills." },
    billing: { draftInvoices: invoices.filter((i) => normalizeInvoiceStatus(i.status) === "draft").length, sentInvoices: invoices.filter((i) => ["sent", "viewed", "partial", "overdue"].includes(normalizeInvoiceStatus(i.status))).length, paidInvoices: invoices.filter((i) => normalizeInvoiceStatus(i.status) === "paid").length, overdueInvoices: invoices.filter((i) => normalizeInvoiceStatus(i.status) === "overdue").length, totalInvoiced: amountInvoiced, totalCollected: paymentsReceived, outstandingBalance: outstandingReceivables, retainage, unbilledContractAmount: unbilledContractValue, source: ["invoices.total_amount", "invoices.amount_paid", "invoice_payment_history.amount"] },
    availability,
  };
}

export async function buildCompanyFinancialReport(params: { supabase: SupabaseClient<Database>; companyId: string; marginTargetPercent?: number }): Promise<CompanyFinancialReport> {
  const marginTargetPercent = params.marginTargetPercent ?? 20;
  const projectsResponse = await params.supabase.from("projects").select("id, name, status, contract_amount, estimated_cost").eq("company_id", params.companyId);
  if (projectsResponse.error) throw new Error(projectsResponse.error.message);
  const projects = (projectsResponse.data ?? []) as ProjectRow[];
  let companyRevenue = 0, totalBacklog = 0, totalOutstandingReceivables = 0, committedCost = 0, projectGrossProfit = 0, jobsOverBudget = 0, jobsUnderMarginTarget = 0;
  for (const project of projects) {
    try {
      const report = await buildProjectFinancialReport({ supabase: params.supabase, companyId: params.companyId, projectId: project.id });
      companyRevenue += report.summary.revisedContractValue;
      totalBacklog += report.summary.unbilledContractValue;
      totalOutstandingReceivables += report.summary.outstandingReceivables;
      committedCost += report.summary.committedCost;
      projectGrossProfit += report.summary.grossProfit;
      if (report.summary.forecastFinalCost > report.summary.revisedBudget) jobsOverBudget += 1;
      if (report.summary.grossMarginPercent !== null && report.summary.grossMarginPercent < marginTargetPercent) jobsUnderMarginTarget += 1;
    } catch { /* one incomplete project should not block company rollup */ }
  }
  const projectMarginPercent = companyRevenue > 0 ? toMoney((projectGrossProfit / companyRevenue) * 100) : null;
  return {
    summary: { companyRevenue: toMoney(companyRevenue), totalBacklog: toMoney(totalBacklog), totalOutstandingReceivables: toMoney(totalOutstandingReceivables), committedCost: toMoney(committedCost), projectGrossProfit: toMoney(projectGrossProfit), projectMarginPercent, jobsOverBudget, jobsUnderMarginTarget, cashExposure: toMoney(totalOutstandingReceivables + committedCost), source: ["derived"] },
    projectsReviewed: projects.length,
    marginTargetPercent,
    availability: [
      { key: "company_revenue", label: "Company revenue", status: "available", detail: "Aggregated from project contracts, estimates, and approved change orders." },
      { key: "company_ar", label: "Company receivables", status: "available", detail: "Aggregated from project invoices and recorded payments." },
      { key: "company_ap", label: "Company payables / actual cost", status: "partial", detail: "Vendor bills now feed project actual cost; company cash disbursement and banking reconciliation remain a later finance layer." },
      { key: "company_margin", label: "Project margin", status: "available", detail: "Uses revised contract values and forecast final project cost." },
    ],
  };
}
