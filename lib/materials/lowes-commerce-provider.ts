import "server-only";
import { lowesSupplierCapability, type LowesAdapterConfig } from "./lowes-adapter";
import { SupplierCommerceError, type SupplierCommerceProvider, type SupplierProductQuery, type SupplierProductQuote } from "./supplier-commerce";

export type LowesCommerceSecrets = {
  clientId: string;
  accessToken: string;
  apiBaseUrl: string;
};

type FetchLike = typeof fetch;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstRecordArray(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) return payload.map(asRecord).filter((value): value is UnknownRecord => Boolean(value));
  const root = asRecord(payload);
  if (!root) return [];
  for (const key of ["items", "products", "results", "data"]) {
    const value = root[key];
    if (Array.isArray(value)) return value.map(asRecord).filter((item): item is UnknownRecord => Boolean(item));
    const nested = asRecord(value);
    if (nested) {
      for (const nestedKey of ["items", "products", "results"]) {
        const list = nested[nestedKey];
        if (Array.isArray(list)) return list.map(asRecord).filter((item): item is UnknownRecord => Boolean(item));
      }
    }
  }
  return [];
}

function quoteFromRecord(record: UnknownRecord, query: SupplierProductQuery): SupplierProductQuote | null {
  const supplierSku = asString(record.omniItemId) || asString(record.itemNumber) || asString(record.product_id) || asString(record.id);
  if (!supplierSku) return null;
  const price = asNumber(record.sellingPrice) ?? asNumber(record.selling_price) ?? asNumber(record.price);
  const contractPrice = asNumber(record.contractPrice) ?? asNumber(record.contract_price);
  const stock = asNumber(record.stock) ?? asNumber(record.quantityAvailable) ?? asNumber(record.inventoryQuantity);
  const productUrl = asString(record.pdpUrl) || asString(record.pdp_url) || asString(record.productUrl);
  return {
    supplierSku,
    productName: asString(record.productName) || asString(record.description) || asString(record.title),
    unitPrice: price,
    contractorPrice: contractPrice,
    stockQuantity: stock,
    availability: asString(record.availability) || (stock == null ? null : stock > 0 ? "in_stock" : "out_of_stock"),
    productUrl,
    storeId: query.storeId ?? null,
    observedAt: new Date().toISOString(),
    metadata: record,
  };
}

async function parseProviderResponse(response: Response) {
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const detail = asRecord(payload);
    const message = asString(detail?.message) || asString(detail?.error) || `Lowe's returned HTTP ${response.status}.`;
    if (response.status === 401 || response.status === 403) throw new SupplierCommerceError("AUTH", message, false);
    throw new SupplierCommerceError("PROVIDER", message, response.status === 429 || response.status >= 500);
  }
  return payload;
}

export function createLowesCommerceProvider(input: {
  adapterConfig: LowesAdapterConfig;
  secrets: LowesCommerceSecrets;
  fetchImpl?: FetchLike;
}): SupplierCommerceProvider {
  const fetchImpl = input.fetchImpl ?? fetch;
  const baseUrl = input.secrets.apiBaseUrl.replace(/\/$/, "");
  const headers = () => ({
    Authorization: `Bearer ${input.secrets.accessToken}`,
    "X-Client-Id": input.secrets.clientId,
    "Content-Type": "application/json",
  });

  async function searchProducts(query: SupplierProductQuery): Promise<SupplierProductQuote[]> {
    if (!input.adapterConfig.productCatalogEnabled) throw new SupplierCommerceError("CONFIGURATION", "Lowe's Product Catalog capability is not enabled.");
    if (!query.searchTerms?.trim() && !query.supplierSkus?.length) throw new SupplierCommerceError("VALIDATION", "Search terms or supplier SKUs are required.");

    if (query.supplierSkus?.length) {
      const response = await fetchImpl(`${baseUrl}/api/v1/items`, {
        method: "POST",
        headers: headers(),
        cache: "no-store",
        body: JSON.stringify({
          omniItemIds: query.supplierSkus.slice(0, 100).map((omniItemId) => ({ omniItemId })),
          email: query.proCustomerEmail || undefined,
          storeNumber: query.storeId || undefined,
          zipCode: query.zipCode || undefined,
          responseGroup: "large",
          unzipped: false,
          clients: ["PRODUCT", "PRICE", "INVENTORY"],
        }),
      });
      const payload = await parseProviderResponse(response);
      return firstRecordArray(payload).map((record) => quoteFromRecord(record, query)).filter((value): value is SupplierProductQuote => Boolean(value));
    }

    const params = new URLSearchParams({ site: "LOWES", searchTerms: query.searchTerms!.trim(), maxResults: "24" });
    if (query.storeId) params.set("storeNumber", query.storeId);
    if (query.zipCode) params.set("zipCode", query.zipCode);
    const response = await fetchImpl(`${baseUrl}/api/v1/search/items?${params.toString()}`, { method: "GET", headers: headers(), cache: "no-store" });
    const payload = await parseProviderResponse(response);
    return firstRecordArray(payload).map((record) => quoteFromRecord(record, query)).filter((value): value is SupplierProductQuote => Boolean(value));
  }

  return {
    capability: lowesSupplierCapability(input.adapterConfig),
    searchProducts,
    async submitOrder() {
      throw new SupplierCommerceError("UNSUPPORTED", "Lowe's order submission is intentionally disabled until the partner account exposes the approved Cart/Checkout/Order Management contract and credentials.");
    },
  };
}
