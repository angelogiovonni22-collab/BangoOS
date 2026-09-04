import "server-only";
import { evaluateLowesIntegration, type LowesAdapterConfig } from "./lowes-adapter";

function enabled(value: string | undefined) {
  return value === "1" || value === "true";
}

export function getLowesAdapterConfig(): LowesAdapterConfig {
  return {
    environment: process.env.LOWES_ENVIRONMENT === "production" ? "production" : "sandbox",
    clientIdConfigured: Boolean(process.env.LOWES_CLIENT_ID),
    clientSecretConfigured: Boolean(process.env.LOWES_CLIENT_SECRET || process.env.LOWES_ACCESS_TOKEN),
    apiBaseUrlConfigured: Boolean(process.env.LOWES_API_BASE_URL),
    proAccountLinked: enabled(process.env.LOWES_PRO_ACCOUNT_LINKED),
    productCatalogEnabled: enabled(process.env.LOWES_PRODUCT_CATALOG_ENABLED),
    pricingEnabled: enabled(process.env.LOWES_PRICING_ENABLED),
    inventoryEnabled: enabled(process.env.LOWES_INVENTORY_ENABLED),
    orderingEnabled: enabled(process.env.LOWES_ORDERING_ENABLED),
    orderStatusEnabled: enabled(process.env.LOWES_ORDER_STATUS_ENABLED),
  };
}

export function getLowesPublicReadiness() {
  const config = getLowesAdapterConfig();
  return { environment: config.environment, ...evaluateLowesIntegration(config) };
}

export function getLowesRuntimeSecrets() {
  const clientId = process.env.LOWES_CLIENT_ID;
  const accessToken = process.env.LOWES_ACCESS_TOKEN;
  const apiBaseUrl = process.env.LOWES_API_BASE_URL;
  if (!clientId || !accessToken || !apiBaseUrl) return null;
  return { clientId, accessToken, apiBaseUrl };
}
