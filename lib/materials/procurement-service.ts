import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { fulfillmentOperation } from "./fulfillment-operation";
import type {
  AllocateMaterialInput,
  CreateMaterialRequestInput,
  CreatePurchaseOrderInput,
  ProcurementMaterialRequest,
  ProcurementOverviewPayload,
  ProcurementProjectSummary,
  ProcurementVendorSummary,
  PurchaseOrderStatus,
  ReceivePurchaseOrderLineInput,
} from "./procurement-types";

type QueryableSupabase = NonNullable<ReturnType<typeof createClient>> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type WorkspaceContext = {
  companyId: string;
  userId: string;
};

type MaterialRequestRow = {
  id: string;
  request_number: string;
  project_id: string;
  priority: "low" | "normal" | "high" | "critical";
  status: ProcurementMaterialRequest["status"];
  needed_by_date: string | null;
  notes: string | null;
  created_at: string;
  requested_by: string | null;
};

type PurchaseOrderRow = {
  id: string;
  po_number: string;
  vendor_id: string;
  project_id: string;
  cost_code_id: string | null;
  status: PurchaseOrderStatus;
  subtotal_amount: number;
  tax_amount: number;
  shipping_amount: number;
  total_amount: number;
  issued_at: string | null;
  created_at: string;
  notes: string | null;
};

type PurchaseOrderLineRow = {
  id: string;
  purchase_order_id: string;
  material_id: string | null;
  description: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
  quantity_backordered: number;
  unit_cost: number;
  line_subtotal: number;
  project_id: string;
  cost_code_id: string | null;
  project_material_plan_item_id: string | null;
};

type ProjectRow = { id: string; name: string };

type VendorRow = { id: string; display_name: string; company_name: string };

type MaterialRow = { id: string; name: string; status: string; unit_of_measure: string; current_stock: number; track_inventory: boolean; last_purchase_cost: number; last_purchase_date: string | null };

type CostCodeRow = { id: string; code: string; name: string };

type ServiceDependencies = {
  supabaseClient?: ReturnType<typeof createClient>;
  resolveWorkspace?: typeof resolveWorkspaceContext;
  now?: () => string;
};

export class ProcurementServiceError extends Error {
  readonly code: "CONTEXT" | "VALIDATION" | "PERSISTENCE" | "NOT_FOUND";

  constructor(code: ProcurementServiceError["code"], message: string) {
    super(message);
    this.name = "ProcurementServiceError";
    this.code = code;
  }
}

export type ProcurementService = {
  loadOverview: () => Promise<ProcurementOverviewPayload>;
  createMaterialRequest: (input: CreateMaterialRequestInput) => Promise<ProcurementOverviewPayload>;
  updateMaterialRequestStatus: (requestId: string, status: ProcurementMaterialRequest["status"]) => Promise<ProcurementOverviewPayload>;
  createDraftPurchaseOrder: (input: CreatePurchaseOrderInput) => Promise<ProcurementOverviewPayload>;
  convertRequestToDraftPurchaseOrder: (requestId: string, input: Omit<CreatePurchaseOrderInput, "requestId">) => Promise<ProcurementOverviewPayload>;
  approvePurchaseOrder: (purchaseOrderId: string) => Promise<ProcurementOverviewPayload>;
  issuePurchaseOrder: (purchaseOrderId: string) => Promise<ProcurementOverviewPayload>;
  cancelPurchaseOrder: (purchaseOrderId: string) => Promise<ProcurementOverviewPayload>;
  receivePurchaseOrderLine: (input: ReceivePurchaseOrderLineInput) => Promise<ProcurementOverviewPayload>;
  allocateMaterialToProject: (input: AllocateMaterialInput) => Promise<ProcurementOverviewPayload>;
  getVendorSummary: (vendorId: string) => Promise<ProcurementVendorSummary>;
  getProjectSummary: (projectId: string) => Promise<ProcurementProjectSummary>;
};

function buildRequestNumber() {
  const now = new Date();
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  const randomPart = Math.floor(Math.random() * 9000 + 1000);
  return `MR-${datePart}-${randomPart}`;
}

function toNumber(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(2));
}

async function ensureWorkspace(
  supabase: QueryableSupabase,
  resolveWorkspace: typeof resolveWorkspaceContext,
): Promise<WorkspaceContext> {
  const workspace = await resolveWorkspace(supabase);

  if (!workspace.context) {
    throw new ProcurementServiceError("CONTEXT", workspace.errorMessage || "Unable to resolve workspace.");
  }

  return {
    companyId: workspace.context.companyId,
    userId: workspace.context.userId,
  };
}

export function createProcurementService(deps: ServiceDependencies = {}): ProcurementService {
  const baseClient = deps.supabaseClient ?? createClient();
  const resolveWorkspace = deps.resolveWorkspace ?? resolveWorkspaceContext;
  const now = deps.now ?? (() => new Date().toISOString());

  if (!baseClient) {
    throw new ProcurementServiceError("PERSISTENCE", "Unable to connect to storage.");
  }

  const supabase = baseClient as QueryableSupabase;

  async function loadOverviewInternal(context: WorkspaceContext): Promise<ProcurementOverviewPayload> {
    const [
      requestResponse,
      purchaseOrderResponse,
      lineItemResponse,
      vendorResponse,
      projectResponse,
      materialResponse,
      costCodeResponse,
      profileResponse,
    ] = await Promise.all([
      supabase
        .from("material_requests")
        .select("id, request_number, project_id, priority, status, needed_by_date, notes, created_at, requested_by")
        .eq("company_id", context.companyId)
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("purchase_orders")
        .select("id, po_number, vendor_id, project_id, cost_code_id, status, subtotal_amount, tax_amount, shipping_amount, total_amount, issued_at, created_at, notes")
        .eq("company_id", context.companyId)
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("purchase_order_line_items")
        .select("id, purchase_order_id, material_id, description, quantity_ordered, quantity_received, quantity_damaged, quantity_backordered, unit_cost, line_subtotal, project_id, cost_code_id, project_material_plan_item_id")
        .eq("company_id", context.companyId)
        .order("created_at", { ascending: false })
        .limit(600),
      supabase
        .from("vendors")
        .select("id, display_name, company_name")
        .eq("company_id", context.companyId)
        .order("display_name", { ascending: true }),
      supabase
        .from("projects")
        .select("id, name")
        .eq("company_id", context.companyId)
        .order("name", { ascending: true }),
      supabase
        .from("materials")
        .select("id, name, status, unit_of_measure, current_stock")
        .eq("company_id", context.companyId)
        .order("name", { ascending: true }),
      supabase
        .from("cost_codes")
        .select("id, code, name")
        .eq("company_id", context.companyId)
        .order("code", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("company_id", context.companyId),
    ]);

    if (requestResponse.error || purchaseOrderResponse.error || lineItemResponse.error || vendorResponse.error || projectResponse.error || materialResponse.error || costCodeResponse.error || profileResponse.error) {
      throw new ProcurementServiceError("PERSISTENCE", requestResponse.error?.message
        || purchaseOrderResponse.error?.message
        || lineItemResponse.error?.message
        || vendorResponse.error?.message
        || projectResponse.error?.message
        || materialResponse.error?.message
        || costCodeResponse.error?.message
        || profileResponse.error?.message
        || "Unable to load procurement data.");
    }

    const vendors = (vendorResponse.data ?? []) as VendorRow[];
    const projects = (projectResponse.data ?? []) as ProjectRow[];
    const materials = (materialResponse.data ?? []) as MaterialRow[];
    const costCodes = (costCodeResponse.data ?? []) as CostCodeRow[];
    const requests = (requestResponse.data ?? []) as MaterialRequestRow[];
    const purchaseOrders = (purchaseOrderResponse.data ?? []) as PurchaseOrderRow[];
    const lineItems = (lineItemResponse.data ?? []) as PurchaseOrderLineRow[];

    const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor.display_name || vendor.company_name]));
    const projectMap = new Map(projects.map((project) => [project.id, project.name]));
    const costCodeMap = new Map(costCodes.map((costCode) => [costCode.id, `${costCode.code} ${costCode.name}`]));
    const materialMap = new Map(materials.map((material) => [material.id, material.name]));

    const profileMap = new Map(
      ((profileResponse.data ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>).map((profile) => [
        profile.id,
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Unknown",
      ]),
    );

    return {
      requests: requests.map((request) => ({
        id: request.id,
        requestNumber: request.request_number,
        projectId: request.project_id,
        projectName: projectMap.get(request.project_id) || "Unknown project",
        requestedBy: request.requested_by ? profileMap.get(request.requested_by) || null : null,
        priority: request.priority,
        status: request.status,
        neededByDate: request.needed_by_date,
        notes: request.notes,
        createdAt: request.created_at,
      })),
      purchaseOrders: purchaseOrders.map((order) => ({
        id: order.id,
        poNumber: order.po_number,
        vendorId: order.vendor_id,
        vendorName: vendorMap.get(order.vendor_id) || "Unknown vendor",
        projectId: order.project_id,
        projectName: projectMap.get(order.project_id) || "Unknown project",
        costCodeId: order.cost_code_id,
        costCodeLabel: order.cost_code_id ? costCodeMap.get(order.cost_code_id) || null : null,
        status: order.status,
        subtotalAmount: Number(order.subtotal_amount ?? 0),
        taxAmount: Number(order.tax_amount ?? 0),
        shippingAmount: Number(order.shipping_amount ?? 0),
        totalAmount: Number(order.total_amount ?? 0),
        issuedAt: order.issued_at,
        createdAt: order.created_at,
        notes: order.notes,
      })),
      lineItems: lineItems.map((line) => ({
        id: line.id,
        purchaseOrderId: line.purchase_order_id,
        materialId: line.material_id,
        materialName: line.material_id ? materialMap.get(line.material_id) || line.description : line.description,
        description: line.description,
        quantityOrdered: Number(line.quantity_ordered ?? 0),
        quantityReceived: Number(line.quantity_received ?? 0),
        quantityDamaged: Number(line.quantity_damaged ?? 0),
        quantityBackordered: Number(line.quantity_backordered ?? 0),
        unitCost: Number(line.unit_cost ?? 0),
        lineSubtotal: Number(line.line_subtotal ?? 0),
        projectId: line.project_id,
        costCodeId: line.cost_code_id,
        projectMaterialPlanItemId: line.project_material_plan_item_id,
      })),
      vendors: vendors.map((vendor) => ({ id: vendor.id, name: vendor.display_name || vendor.company_name })),
      projects: projects.map((project) => ({ id: project.id, name: project.name })),
      materials: materials.filter((material) => material.status === "active").map((material) => ({
        id: material.id,
        name: material.name,
        unitOfMeasure: material.unit_of_measure,
        currentStock: material.current_stock,
      })),
      costCodes: costCodes.map((costCode) => ({ id: costCode.id, label: `${costCode.code} ${costCode.name}` })),
    };
  }

  async function transitionOrder(purchaseOrderId: string, action: "approve" | "issue" | "cancel") {
    const context = await ensureWorkspace(supabase, resolveWorkspace);
    const operation = fulfillmentOperation(context.companyId, context.userId, action, { purchaseOrderId }, new Date(now()));
    const { error } = await supabase.rpc("transition_procurement_order", {
      p_company_id: context.companyId,
      p_operation_id: operation.id,
      p_purchase_order_id: purchaseOrderId,
      p_action: action,
    });
    if (error) throw new ProcurementServiceError("PERSISTENCE", error.message);
    const overview = await loadOverviewInternal(context);
    operation.complete();
    return overview;
  }

  return {
    async loadOverview() {
      const context = await ensureWorkspace(supabase, resolveWorkspace);
      return loadOverviewInternal(context);
    },

    async createMaterialRequest(input) {
      const context = await ensureWorkspace(supabase, resolveWorkspace);

      if (!input.projectId.trim()) {
        throw new ProcurementServiceError("VALIDATION", "Project is required.");
      }

      const { error } = await supabase
        .from("material_requests")
        .insert({
          company_id: context.companyId,
          project_id: input.projectId,
          request_number: buildRequestNumber(),
          priority: input.priority,
          status: "submitted",
          needed_by_date: input.neededByDate,
          notes: input.notes,
          requested_by: context.userId,
          created_by: context.userId,
          updated_by: context.userId,
        });

      if (error) {
        throw new ProcurementServiceError("PERSISTENCE", error.message);
      }

      return loadOverviewInternal(context);
    },

    async updateMaterialRequestStatus(requestId, status) {
      const context = await ensureWorkspace(supabase, resolveWorkspace);

      const { error } = await supabase
        .from("material_requests")
        .update({ status, updated_by: context.userId, updated_at: now() })
        .eq("company_id", context.companyId)
        .eq("id", requestId);

      if (error) {
        throw new ProcurementServiceError("PERSISTENCE", error.message);
      }

      return loadOverviewInternal(context);
    },

    async createDraftPurchaseOrder(input) {
      const context = await ensureWorkspace(supabase, resolveWorkspace);

      if (!input.vendorId.trim() || !input.projectId.trim() || input.lines.length === 0) {
        throw new ProcurementServiceError("VALIDATION", "Vendor, project, and at least one line are required.");
      }

      if (![input.taxAmount, input.shippingAmount].every((amount) => Number.isFinite(amount) && amount >= 0)
        || input.lines.some((line) => !line.description.trim() || !Number.isFinite(line.quantityOrdered) || line.quantityOrdered <= 0 || !Number.isFinite(line.unitCost) || line.unitCost < 0)) {
        throw new ProcurementServiceError("VALIDATION", "Use positive quantities and non-negative costs, tax, and shipping for every line.");
      }

      const payload = {
        ...input,
        lines: input.lines.map((line) => ({ ...line, projectMaterialPlanItemId: line.projectMaterialPlanItemId || null })),
      };
      const operation = fulfillmentOperation(context.companyId, context.userId, "draft", payload, new Date(now()));
      const { error } = await supabase.rpc("create_procurement_draft", {
        p_company_id: context.companyId,
        p_operation_id: operation.id,
        p_payload: payload,
      });
      if (error) throw new ProcurementServiceError("PERSISTENCE", error.message);
      const overview = await loadOverviewInternal(context);
      operation.complete();
      return overview;
    },

    async convertRequestToDraftPurchaseOrder(requestId, input) {
      return this.createDraftPurchaseOrder({ ...input, requestId });
    },

    async approvePurchaseOrder(purchaseOrderId) {
      return transitionOrder(purchaseOrderId, "approve");
    },

    async issuePurchaseOrder(purchaseOrderId) {
      return transitionOrder(purchaseOrderId, "issue");
    },

    async cancelPurchaseOrder(purchaseOrderId) {
      return transitionOrder(purchaseOrderId, "cancel");
    },

    async receivePurchaseOrderLine(input) {
      const context = await ensureWorkspace(supabase, resolveWorkspace);
      const quantities = [input.quantityReceived, input.quantityDamaged, input.quantityBackordered];
      if (!quantities.every((quantity) => Number.isFinite(quantity) && quantity >= 0) || quantities.every((quantity) => quantity === 0)) {
        throw new ProcurementServiceError("VALIDATION", "Enter at least one positive received, damaged, or backordered quantity.");
      }
      const operation = fulfillmentOperation(context.companyId, context.userId, "receive", input, new Date(now()));
      const { error } = await supabase.rpc("apply_procurement_fulfillment", {
        p_company_id: context.companyId,
        p_operation_id: operation.id,
        p_kind: "receive",
        p_payload: { ...input, receivedDate: operation.receivedDate },
      });
      if (error) throw new ProcurementServiceError("PERSISTENCE", error.message);
      const overview = await loadOverviewInternal(context);
      operation.complete();
      return overview;
    },

    async allocateMaterialToProject(input) {
      const context = await ensureWorkspace(supabase, resolveWorkspace);
      if (!Number.isFinite(input.quantityAllocated) || input.quantityAllocated <= 0 || !Number.isFinite(input.unitCost) || input.unitCost < 0) {
        throw new ProcurementServiceError("VALIDATION", "Enter a positive allocated quantity and a finite, non-negative unit cost.");
      }
      const operation = fulfillmentOperation(context.companyId, context.userId, "allocate", input, new Date(now()));
      const { error } = await supabase.rpc("apply_procurement_fulfillment", {
        p_company_id: context.companyId,
        p_operation_id: operation.id,
        p_kind: "allocate",
        p_payload: { ...input },
      });
      if (error) throw new ProcurementServiceError("PERSISTENCE", error.message);
      const overview = await loadOverviewInternal(context);
      operation.complete();
      return overview;
    },

    async getVendorSummary(vendorId) {
      const context = await ensureWorkspace(supabase, resolveWorkspace);

      const [ordersResponse, lineItemsResponse, tradePartnersResponse, projectsResponse] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select("id, status, total_amount, project_id")
          .eq("company_id", context.companyId)
          .eq("vendor_id", vendorId),
        supabase
          .from("purchase_order_line_items")
          .select("purchase_order_id, quantity_ordered, quantity_received, quantity_damaged")
          .eq("company_id", context.companyId),
        supabase
          .from("trade_partner_assignments")
          .select("project_id")
          .eq("company_id", context.companyId)
          .eq("vendor_id", vendorId),
        supabase
          .from("projects")
          .select("id, name")
          .eq("company_id", context.companyId),
      ]);

      if (ordersResponse.error || lineItemsResponse.error || tradePartnersResponse.error || projectsResponse.error) {
        throw new ProcurementServiceError(
          "PERSISTENCE",
          ordersResponse.error?.message || lineItemsResponse.error?.message || tradePartnersResponse.error?.message || projectsResponse.error?.message || "Unable to load vendor procurement summary.",
        );
      }

      const orders = (ordersResponse.data ?? []) as Array<{ id: string; status: PurchaseOrderStatus; total_amount: number; project_id: string }>;
      const linesByOrderId = new Map<string, Array<{ quantity_ordered: number; quantity_received: number; quantity_damaged: number }>>();
      for (const line of (lineItemsResponse.data ?? []) as Array<{ purchase_order_id: string; quantity_ordered: number; quantity_received: number; quantity_damaged: number }>) {
        const existing = linesByOrderId.get(line.purchase_order_id);
        if (existing) {
          existing.push(line);
        } else {
          linesByOrderId.set(line.purchase_order_id, [line]);
        }
      }

      const activePurchaseOrders = orders.filter((order) => order.status === "approved" || order.status === "issued" || order.status === "partially_received").length;
      const orderHistoryCount = orders.length;

      let orderedTotal = 0;
      let receivedTotal = 0;
      let outstandingBalanceAmount = 0;

      for (const order of orders.filter((order) => order.status !== "cancelled" && order.status !== "draft")) {
        const lines = linesByOrderId.get(order.id) ?? [];

        for (const line of lines) {
          orderedTotal += line.quantity_ordered;
          receivedTotal += line.quantity_received + line.quantity_damaged;
        }

        if (order.status !== "fully_received" && order.status !== "cancelled") {
          outstandingBalanceAmount += Number(order.total_amount ?? 0);
        }
      }

      const deliveryPerformancePercent = orderedTotal > 0 ? Math.round((receivedTotal / orderedTotal) * 100) : 100;

      const projectMap = new Map(((projectsResponse.data ?? []) as Array<{ id: string; name: string }>).map((project) => [project.id, project.name]));
      const associatedProjectIds = new Set<string>();
      for (const order of orders) {
        associatedProjectIds.add(order.project_id);
      }
      for (const assignment of (tradePartnersResponse.data ?? []) as Array<{ project_id: string }>) {
        associatedProjectIds.add(assignment.project_id);
      }

      const associatedProjects = Array.from(associatedProjectIds)
        .map((projectId) => ({ id: projectId, name: projectMap.get(projectId) || "Unknown project" }))
        .sort((left, right) => left.name.localeCompare(right.name));

      return {
        activePurchaseOrders,
        orderHistoryCount,
        deliveryPerformancePercent,
        outstandingBalanceAmount: toNumber(outstandingBalanceAmount),
        associatedProjects,
      };
    },

    async getProjectSummary(projectId) {
      const context = await ensureWorkspace(supabase, resolveWorkspace);

      const [ordersResponse, linesResponse, allocationsResponse] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select("id, status")
          .eq("company_id", context.companyId)
          .eq("project_id", projectId),
        supabase
          .from("purchase_order_line_items")
          .select("purchase_order_id, project_id, quantity_ordered, quantity_received, quantity_damaged")
          .eq("company_id", context.companyId)
          .eq("project_id", projectId),
        supabase
          .from("project_material_allocations")
          .select("total_cost")
          .eq("company_id", context.companyId)
          .eq("project_id", projectId),
      ]);

      if (ordersResponse.error || linesResponse.error || allocationsResponse.error) {
        throw new ProcurementServiceError(
          "PERSISTENCE",
          ordersResponse.error?.message || linesResponse.error?.message || allocationsResponse.error?.message || "Unable to load project procurement summary.",
        );
      }

      const orders = (ordersResponse.data ?? []) as Array<{ id: string; status: PurchaseOrderStatus }>;
      const lines = (linesResponse.data ?? []) as Array<{ purchase_order_id: string; project_id: string; quantity_ordered: number; quantity_received: number; quantity_damaged: number }>;

      const activeOrderIds = new Set(orders.filter((order) => order.status !== "cancelled").map((order) => order.id));
      const pendingOrderIds = new Set(orders.filter((order) => order.status !== "cancelled" && order.status !== "fully_received").map((order) => order.id));
      const materialsOrdered = lines.filter((line) => activeOrderIds.has(line.purchase_order_id)).reduce((sum, line) => sum + Number(line.quantity_ordered ?? 0), 0);
      const materialsReceived = lines.reduce((sum, line) => sum + Number(line.quantity_received ?? 0) + Number(line.quantity_damaged ?? 0), 0);
      const outstandingOrders = orders.filter((order) => order.status === "draft" || order.status === "approved" || order.status === "issued" || order.status === "partially_received").length;
      const pendingDeliveries = lines.filter((line) => pendingOrderIds.has(line.purchase_order_id) && Number(line.quantity_ordered ?? 0) > Number(line.quantity_received ?? 0) + Number(line.quantity_damaged ?? 0)).length;
      const materialCost = toNumber((allocationsResponse.data ?? []).reduce((sum: number, row: { total_cost: number }) => sum + Number(row.total_cost ?? 0), 0));

      return {
        materialsOrdered,
        materialsReceived,
        outstandingOrders,
        materialCost,
        pendingDeliveries,
      };
    },
  };
}
