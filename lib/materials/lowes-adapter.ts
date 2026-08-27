import { authorizeSupplierOrderSubmission, type SupplierOrderCapability } from "./supplier-order-integration";

export type LowesEnvironment = "sandbox" | "production";

export type LowesAdapterConfig = {
  environment: LowesEnvironment;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
  apiBaseUrlConfigured: boolean;
  proAccountLinked: boolean;
  productCatalogEnabled: boolean;
  pricingEnabled: boolean;
  inventoryEnabled: boolean;
  orderingEnabled: boolean;
  orderStatusEnabled: boolean;
};

export type LowesIntegrationReadiness = {
  catalogReady: boolean;
  pricingReady: boolean;
  inventoryReady: boolean;
  orderingReady: boolean;
  orderStatusReady: boolean;
  blockers: string[];
};

export function evaluateLowesIntegration(config: LowesAdapterConfig): LowesIntegrationReadiness {
  const credentialsReady = config.clientIdConfigured && config.clientSecretConfigured && config.apiBaseUrlConfigured;
  const blockers: string[] = [];
  if (!config.clientIdConfigured) blockers.push("Lowe's client ID is not configured.");
  if (!config.clientSecretConfigured) blockers.push("Lowe's client secret is not configured.");
  if (!config.apiBaseUrlConfigured) blockers.push("Lowe's API base URL is not configured.");
  if (!config.proAccountLinked) blockers.push("Lowe's Pro account is not linked.");
  if (!config.orderingEnabled) blockers.push("Lowe's order submission capability is not enabled.");

  return {
    catalogReady: credentialsReady && config.productCatalogEnabled,
    pricingReady: credentialsReady && config.proAccountLinked && config.pricingEnabled,
    inventoryReady: credentialsReady && config.inventoryEnabled,
    orderingReady: credentialsReady && config.proAccountLinked && config.orderingEnabled,
    orderStatusReady: credentialsReady && config.orderStatusEnabled,
    blockers,
  };
}

export function lowesSupplierCapability(config: LowesAdapterConfig): SupplierOrderCapability {
  const readiness = evaluateLowesIntegration(config);
  return {
    vendorId: "lowes",
    vendorName: "Lowe's",
    channel: "api",
    enabled: readiness.catalogReady || readiness.pricingReady || readiness.inventoryReady || readiness.orderingReady,
    endpointConfigured: config.apiBaseUrlConfigured,
    credentialsConfigured: config.clientIdConfigured && config.clientSecretConfigured,
    supportsAvailability: readiness.inventoryReady,
    supportsPricing: readiness.pricingReady,
    supportsOrderSubmission: readiness.orderingReady,
  };
}

export function authorizeLowesOrder(input: {
  purchaseOrderId: string;
  approved: boolean;
  approvalConfirmedAt: string | null;
  config: LowesAdapterConfig;
}) {
  return authorizeSupplierOrderSubmission({
    purchaseOrderId: input.purchaseOrderId,
    approved: input.approved,
    approvalConfirmedAt: input.approvalConfirmedAt,
    capability: lowesSupplierCapability(input.config),
  });
}

export function lowesEnvironmentLabel(environment: LowesEnvironment) {
  return environment === "production" ? "Lowe's Production" : "Lowe's Sandbox";
}
