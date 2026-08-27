import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { createProcurementService } from "./procurement-service";
import type {
  ProjectMaterialPlanItem,
  ProjectMaterialPlanPayload,
  ProjectMaterialPlanStatus,
  UpdateProjectMaterialPlanInput,
} from "./project-material-plan-types";

type QueryableSupabase = NonNullable<ReturnType<typeof createClient>> & {
  // Generated database types intentionally trail procurement migrations in this repository.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type PlanRow = {
  id: string;
  project_id: string;
  estimate_id: string | null;
  material_id: string | null;
  selected_vendor_id: string | null;
  selected_supplier_price_entry_id: string | null;
  description: string;
  item_code: string | null;
  unit_of_measure: string;
  estimated_quantity: number;
  inventory_quantity: number;
  original_unit_cost: number;
  current_unit_cost: number | null;
  required_on: string | null;
  status: ProjectMaterialPlanStatus;
};

type OrderLineRow = {
  project_material_plan_item_id: string | null;
  purchase_order_id: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
};

type ServiceDependencies = {
  client?: ReturnType<typeof createClient>;
  now?: () => string;
};

export class ProjectMaterialPlanError extends Error {}

export function createProjectMaterialPlanService(deps: ServiceDependencies = {}) {
  const baseClient = deps.client ?? createClient();
  const now = deps.now ?? (() => new Date().toISOString());
  if (!baseClient) throw new ProjectMaterialPlanError("Unable to connect to storage.");
  const supabase = baseClient as QueryableSupabase;

  async function workspace() {
    const result = await resolveWorkspaceContext(baseClient);
    if (!result.context) throw new ProjectMaterialPlanError(result.errorMessage || "Unable to resolve workspace.");
    return result.context;
  }

  async function load(projectId: string): Promise<ProjectMaterialPlanPayload> {
    const context = await workspace();
    const [projectResponse, planResponse, vendorResponse, materialResponse, lineResponse] = await Promise.all([
      supabase.from("projects").select("id, name").eq("company_id", context.companyId).eq("id", projectId).maybeSingle(),
      supabase.from("project_material_plan_items").select("id, project_id, estimate_id, material_id, selected_vendor_id, selected_supplier_price_entry_id, description, item_code, unit_of_measure, estimated_quantity, inventory_quantity, original_unit_cost, current_unit_cost, required_on, status").eq("company_id", context.companyId).eq("project_id", projectId).neq("status", "cancelled").order("created_at"),
      supabase.from("vendors").select("id, display_name").eq("company_id", context.companyId).eq("status", "active").order("display_name"),
      supabase.from("materials").select("id, current_stock").eq("company_id", context.companyId),
      supabase.from("purchase_order_line_items").select("project_material_plan_item_id, purchase_order_id, quantity_ordered, quantity_received, quantity_damaged").eq("company_id", context.companyId).eq("project_id", projectId).not("project_material_plan_item_id", "is", null),
    ]);

    const error = projectResponse.error || planResponse.error || vendorResponse.error || materialResponse.error || lineResponse.error;
    if (error) throw new ProjectMaterialPlanError(error.message);
    if (!projectResponse.data) throw new ProjectMaterialPlanError("Project not found.");

    const orderLines = (lineResponse.data ?? []) as OrderLineRow[];
    const orderIds = [...new Set(orderLines.map((line) => line.purchase_order_id))];
    const { data: orderRows, error: orderError } = orderIds.length
      ? await supabase.from("purchase_orders").select("id, status").eq("company_id", context.companyId).in("id", orderIds)
      : { data: [], error: null };
    if (orderError) throw new ProjectMaterialPlanError(orderError.message);

    const orderStatus = new Map((orderRows ?? []).map((order: { id: string; status: string }) => [order.id, order.status]));
    const vendorNames = new Map((vendorResponse.data ?? []).map((vendor: { id: string; display_name: string }) => [vendor.id, vendor.display_name]));
    const stock = new Map((materialResponse.data ?? []).map((material: { id: string; current_stock: number }) => [material.id, Number(material.current_stock ?? 0)]));

    const items = ((planResponse.data ?? []) as PlanRow[]).map((row): ProjectMaterialPlanItem => {
      const linkedLines = orderLines.filter((line) => line.project_material_plan_item_id === row.id && orderStatus.get(line.purchase_order_id) !== "cancelled");
      const quantityOrdered = linkedLines.reduce((sum, line) => sum + Number(line.quantity_ordered), 0);
      const quantityReceived = linkedLines.reduce((sum, line) => sum + Number(line.quantity_received), 0);
      const inventoryAvailable = row.material_id ? stock.get(row.material_id) ?? 0 : 0;
      const inventoryQuantity = Math.min(Number(row.inventory_quantity), Number(row.estimated_quantity));
      const quantityToPurchase = Math.max(0, Number(row.estimated_quantity) - inventoryQuantity);
      const quantityRemaining = Math.max(0, quantityToPurchase - quantityOrdered);
      const originalUnitCost = Number(row.original_unit_cost);
      const currentUnitCost = Number(row.current_unit_cost ?? row.original_unit_cost);
      const statuses = linkedLines.map((line) => orderStatus.get(line.purchase_order_id) || "draft");
      const orderState = quantityReceived >= quantityToPurchase && quantityToPurchase > 0
        ? "received"
        : quantityReceived > 0
          ? "partially_received"
          : statuses.includes("issued")
            ? "issued"
            : statuses.includes("approved")
              ? "approved"
              : statuses.length > 0
                ? "draft"
                : "not_ordered";

      return {
        id: row.id,
        projectId: row.project_id,
        estimateId: row.estimate_id,
        materialId: row.material_id,
        description: row.description,
        itemCode: row.item_code,
        unitOfMeasure: row.unit_of_measure,
        estimatedQuantity: Number(row.estimated_quantity),
        inventoryAvailable,
        inventoryQuantity,
        quantityToPurchase,
        quantityOrdered,
        quantityReceived,
        quantityRemaining,
        originalUnitCost,
        currentUnitCost,
        estimatedPurchaseCost: quantityToPurchase * originalUnitCost,
        currentPurchaseCost: quantityToPurchase * currentUnitCost,
        costVariance: quantityToPurchase * (currentUnitCost - originalUnitCost),
        selectedVendorId: row.selected_vendor_id,
        selectedVendorName: row.selected_vendor_id ? vendorNames.get(row.selected_vendor_id) || null : null,
        requiredOn: row.required_on,
        status: row.status,
        orderStatus: orderState,
      };
    });

    return {
      project: projectResponse.data as { id: string; name: string },
      items,
      vendors: (vendorResponse.data ?? []).map((vendor: { id: string; display_name: string }) => ({ id: vendor.id, name: vendor.display_name })),
    };
  }

  async function update(projectId: string, input: UpdateProjectMaterialPlanInput) {
    const context = await workspace();
    if (!Number.isFinite(input.inventoryQuantity) || input.inventoryQuantity < 0) throw new ProjectMaterialPlanError("Inventory quantity must be zero or greater.");
    const { error } = await supabase.from("project_material_plan_items").update({
      inventory_quantity: input.inventoryQuantity,
      required_on: input.requiredOn,
      selected_vendor_id: input.selectedVendorId,
      status: "ready_to_order",
      updated_by: context.userId,
      updated_at: now(),
    }).eq("company_id", context.companyId).eq("project_id", projectId).eq("id", input.itemId);
    if (error) throw new ProjectMaterialPlanError(error.message);
    return load(projectId);
  }

  async function createDraftPurchaseOrder(projectId: string, itemIds: string[], vendorId: string) {
    const payload = await load(projectId);
    const selected = payload.items.filter((item) => itemIds.includes(item.id) && item.quantityRemaining > 0);
    if (!vendorId) throw new ProjectMaterialPlanError("Select a supplier before creating the draft purchase order.");
    if (selected.length === 0) throw new ProjectMaterialPlanError("Select at least one material with a remaining purchase quantity.");

    const procurement = createProcurementService({ supabaseClient: baseClient });
    const overview = await procurement.createDraftPurchaseOrder({
      vendorId,
      projectId,
      costCodeId: null,
      taxAmount: 0,
      shippingAmount: 0,
      notes: "Drafted from the project material plan. Final tax, delivery, and approval are required before issue.",
      requestId: null,
      attachments: [],
      lines: selected.map((item) => ({
        projectMaterialPlanItemId: item.id,
        materialId: item.materialId,
        description: item.description,
        quantityOrdered: item.quantityRemaining,
        unitCost: item.currentUnitCost,
        projectId,
        costCodeId: null,
      })),
    });
    const linkedLine = overview.lineItems.find((line) => itemIds.includes(line.projectMaterialPlanItemId || ""));
    return { payload: await load(projectId), purchaseOrderId: linkedLine?.purchaseOrderId || null };
  }

  return { load, update, createDraftPurchaseOrder };
}
