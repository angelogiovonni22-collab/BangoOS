import { authorizeSupplierOrderSubmission, type SupplierOrderCapability } from "./supplier-order-integration";

export type SupplierProductQuery = {
  searchTerms?: string;
  supplierSkus?: string[];
  storeId?: string;
  zipCode?: string;
  proCustomerEmail?: string;
};

export type SupplierProductQuote = {
  supplierSku: string;
  productName: string | null;
  unitPrice: number | null;
  contractorPrice: number | null;
  stockQuantity: number | null;
  availability: string | null;
  productUrl: string | null;
  storeId: string | null;
  observedAt: string;
  metadata: Record<string, unknown>;
};

export type SupplierOrderLine = {
  supplierSku: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type SupplierOrderRequest = {
  purchaseOrderId: string;
  idempotencyKey: string;
  approved: boolean;
  approvalConfirmedAt: string | null;
  delivery: {
    method: "pickup" | "delivery";
    storeId?: string | null;
    address?: string | null;
    zipCode?: string | null;
  };
  lines: SupplierOrderLine[];
};

export type SupplierOrderResult = {
  externalOrderId: string | null;
  externalOrderReference: string | null;
  status: "submitted" | "confirmed" | "attention";
  metadata: Record<string, unknown>;
};

export type SupplierCommerceProvider = {
  capability: SupplierOrderCapability;
  searchProducts: (query: SupplierProductQuery) => Promise<SupplierProductQuote[]>;
  submitOrder: (request: SupplierOrderRequest) => Promise<SupplierOrderResult>;
  getOrderStatus?: (externalOrderId: string) => Promise<SupplierOrderResult>;
};

export class SupplierCommerceError extends Error {
  readonly code: "CONFIGURATION" | "AUTH" | "VALIDATION" | "PROVIDER" | "UNSUPPORTED";
  readonly retryable: boolean;

  constructor(code: SupplierCommerceError["code"], message: string, retryable = false) {
    super(message);
    this.name = "SupplierCommerceError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function validateSupplierOrderRequest(provider: SupplierCommerceProvider, request: SupplierOrderRequest) {
  const authorization = authorizeSupplierOrderSubmission({
    purchaseOrderId: request.purchaseOrderId,
    approved: request.approved,
    approvalConfirmedAt: request.approvalConfirmedAt,
    capability: provider.capability,
  });
  const blockers = [...authorization.blockers];
  if (!request.idempotencyKey.trim()) blockers.push("An idempotency key is required before supplier submission.");
  if (!request.lines.length) blockers.push("At least one supplier order line is required.");
  if (request.lines.some((line) => !line.supplierSku.trim() || line.quantity <= 0 || line.unitPrice < 0)) blockers.push("Every supplier line requires a SKU, positive quantity, and non-negative reviewed price.");
  if (request.delivery.method === "pickup" && !request.delivery.storeId) blockers.push("A supplier store is required for pickup orders.");
  if (request.delivery.method === "delivery" && !request.delivery.address) blockers.push("A delivery address is required for delivery orders.");
  return { authorized: blockers.length === 0, blockers };
}

export function sanitizeSupplierOrderRequest(request: SupplierOrderRequest) {
  return {
    purchaseOrderId: request.purchaseOrderId,
    idempotencyKey: request.idempotencyKey,
    delivery: request.delivery,
    lines: request.lines.map((line) => ({ supplierSku: line.supplierSku, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice })),
  };
}
