export type SupplierOrderChannel = "api" | "punchout" | "portal" | "manual";
export type SupplierOrderCapability = {
  vendorId: string;
  vendorName: string;
  channel: SupplierOrderChannel;
  enabled: boolean;
  endpointConfigured: boolean;
  credentialsConfigured: boolean;
  supportsAvailability: boolean;
  supportsPricing: boolean;
  supportsOrderSubmission: boolean;
};

export type SupplierOrderReadiness = {
  ready: boolean;
  blockers: string[];
  channel: SupplierOrderChannel;
  requiresHumanApproval: true;
};

export function evaluateSupplierOrderReadiness(capability: SupplierOrderCapability): SupplierOrderReadiness {
  const blockers: string[] = [];
  if (!capability.enabled) blockers.push("Supplier integration is not enabled.");
  if (!capability.endpointConfigured && capability.channel !== "manual") blockers.push("Supplier endpoint is not configured.");
  if (!capability.credentialsConfigured && capability.channel !== "manual") blockers.push("Supplier credentials are not configured.");
  if (!capability.supportsOrderSubmission) blockers.push("Supplier channel does not support electronic order submission.");
  return { ready: blockers.length === 0, blockers, channel: capability.channel, requiresHumanApproval: true };
}

export type SupplierOrderSubmission = {
  purchaseOrderId: string;
  approved: boolean;
  approvalConfirmedAt: string | null;
  capability: SupplierOrderCapability;
};

export function authorizeSupplierOrderSubmission(input: SupplierOrderSubmission) {
  const readiness = evaluateSupplierOrderReadiness(input.capability);
  if (!readiness.ready) return { authorized: false as const, blockers: readiness.blockers };
  if (!input.approved || !input.approvalConfirmedAt) {
    return { authorized: false as const, blockers: ["Explicit purchase-order approval is required before supplier submission."] };
  }
  return { authorized: true as const, blockers: [] as string[] };
}
