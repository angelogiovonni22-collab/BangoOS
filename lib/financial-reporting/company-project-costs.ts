import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";

type ProjectCost = { scopeBudget: number | null; changeOrderCost: number; committedMaterials: number; actual: number };
type ScopeRow = { project_id: string; material_cost: number; labor_cost: number };
type ChangeOrder = { id: string; project_id: string | null; status: string };
type CostLine = { change_order_id: string; cost_amount: number };
type Order = { id: string; status: string };
type OrderLine = { project_id: string; purchase_order_id: string; quantity_ordered: number; quantity_received: number; quantity_damaged: number; unit_cost: number };
type Allocation = { project_id: string; total_cost: number };
type Receipt = { project_id: string; total_amount: number };
type Bill = { id: string; project_id: string; status: string };
type BillLine = { project_id: string; vendor_bill_id: string; purchase_order_line_item_id: string | null; line_amount: number };

function amount(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Batch the same cost sources as canonical project reporting, without queries per project. */
export async function loadCompanyProjectCosts(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  changeOrders: ChangeOrder[];
}): Promise<Map<string, ProjectCost>> {
  const db = params.supabase as SupabaseClient<Database> & {
    // Migration-backed finance tables may precede generated types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  };
  const responses = await Promise.all([
    db.from("project_scope_items").select("project_id,material_cost,labor_cost").eq("company_id", params.companyId),
    db.from("change_order_line_items").select("change_order_id,cost_amount").eq("company_id", params.companyId),
    db.from("purchase_orders").select("id,status").eq("company_id", params.companyId),
    db.from("purchase_order_line_items").select("project_id,purchase_order_id,quantity_ordered,quantity_received,quantity_damaged,unit_cost").eq("company_id", params.companyId),
    db.from("project_material_allocations").select("project_id,total_cost").eq("company_id", params.companyId),
    db.from("project_receipts").select("project_id,total_amount").eq("company_id", params.companyId).eq("status", "approved"),
    db.from("vendor_bills").select("id,project_id,status").eq("company_id", params.companyId),
    db.from("vendor_bill_line_items").select("project_id,vendor_bill_id,purchase_order_line_item_id,line_amount").eq("company_id", params.companyId),
  ]);
  for (const response of responses) {
    if (response.error) throw new Error(response.error.message);
  }
  const [scopes, changeLines, orders, orderLines, allocations, receipts, bills, billLines] = responses.map((response) => response.data ?? []) as [ScopeRow[], CostLine[], Order[], OrderLine[], Allocation[], Receipt[], Bill[], BillLine[]];
  const costs = new Map<string, ProjectCost>();
  const get = (id: string) => {
    let cost = costs.get(id);
    if (!cost) {
      cost = { scopeBudget: null, changeOrderCost: 0, committedMaterials: 0, actual: 0 };
      costs.set(id, cost);
    }
    return cost;
  };
  for (const row of scopes) {
    const cost = get(row.project_id);
    cost.scopeBudget = (cost.scopeBudget ?? 0) + amount(row.material_cost) + amount(row.labor_cost);
  }
  const approvedChanges = new Map(params.changeOrders.filter((row) => ["approved", "invoiced"].includes(normalizeChangeOrderStatus(row.status))).map((row) => [row.id, row.project_id]));
  for (const row of changeLines) {
    const projectId = approvedChanges.get(row.change_order_id);
    if (projectId) get(projectId).changeOrderCost += amount(row.cost_amount);
  }
  const orderStatuses = new Map(orders.map((row) => [row.id, String(row.status ?? "").trim().toLowerCase()]));
  for (const row of orderLines) {
    if (["cancelled", "fully_received"].includes(orderStatuses.get(row.purchase_order_id) ?? "draft")) continue;
    get(row.project_id).committedMaterials += Math.max(0, amount(row.quantity_ordered) - amount(row.quantity_received) - amount(row.quantity_damaged)) * amount(row.unit_cost);
  }
  const actualSources = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const addActual = (source: number, projectId: string, value: unknown) => {
    actualSources[source].set(projectId, (actualSources[source].get(projectId) ?? 0) + amount(value));
  };
  for (const row of allocations) addActual(0, row.project_id, row.total_cost);
  for (const row of receipts) addActual(1, row.project_id, row.total_amount);
  const approvedBills = new Map(bills.filter((row) => ["approved", "partially_paid", "paid"].includes(String(row.status ?? ""))).map((row) => [row.id, row.project_id]));
  for (const row of billLines) {
    const projectId = approvedBills.get(row.vendor_bill_id);
    if (!projectId || projectId !== row.project_id || row.purchase_order_line_item_id) continue;
    addActual(2, projectId, row.line_amount);
  }
  // Canonical reporting rounds allocations, receipts, and AP separately before adding them.
  for (const source of actualSources) {
    for (const [projectId, total] of source) get(projectId).actual += Math.round((total + Number.EPSILON) * 100) / 100;
  }
  return costs;
}
