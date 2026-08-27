export type SupplierPriceImportRow = {
  rowNumber: number;
  supplierSku: string;
  productDescription: string;
  manufacturer: string;
  modelNumber: string;
  packageQuantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  contractorPrice: number | null;
  availability: string;
  sourceRow: Record<string, string>;
  errors: string[];
};

export type SupplierPriceImportResult = {
  rows: SupplierPriceImportRow[];
  duplicateSkus: string[];
  headers: string[];
};

const COLUMN_ALIASES = {
  supplierSku: ["sku", "item sku", "item number", "item #", "product id", "vendor sku"],
  productDescription: ["description", "product description", "item description", "product", "name"],
  manufacturer: ["manufacturer", "brand", "make"],
  modelNumber: ["model", "model number", "model #", "mpn", "manufacturer part number"],
  packageQuantity: ["package quantity", "package qty", "pack qty", "pack", "case quantity"],
  unitOfMeasure: ["unit", "uom", "unit of measure"],
  unitPrice: ["unit price", "price", "retail price", "list price", "cost"],
  contractorPrice: ["contractor price", "pro price", "account price", "net price"],
  availability: ["availability", "stock", "in stock", "inventory status"],
} as const;

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function parseCsvRecords(input: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) records.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  row.push(field.trim());
  if (row.some(Boolean)) records.push(row);
  return records;
}

function findColumn(headers: string[], aliases: readonly string[]) {
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function parseMoney(value: string) {
  const normalized = value.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function parseSupplierPriceCsv(input: string): SupplierPriceImportResult {
  const records = parseCsvRecords(input.replace(/^\uFEFF/, ""));
  if (records.length < 2) return { rows: [], duplicateSkus: [], headers: records[0] ?? [] };

  const headers = records[0];
  const columns = Object.fromEntries(
    Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [key, findColumn(headers, aliases)]),
  ) as Record<keyof typeof COLUMN_ALIASES, number>;

  const valueAt = (record: string[], column: number) => (column >= 0 ? record[column]?.trim() ?? "" : "");
  const rows = records.slice(1).map((record, rowIndex): SupplierPriceImportRow => {
    const supplierSku = valueAt(record, columns.supplierSku);
    const productDescription = valueAt(record, columns.productDescription);
    const unitPrice = parseMoney(valueAt(record, columns.unitPrice));
    const packageQuantity = parseMoney(valueAt(record, columns.packageQuantity)) ?? 1;
    const contractorPrice = parseMoney(valueAt(record, columns.contractorPrice));
    const errors: string[] = [];

    if (!supplierSku) errors.push("SKU is required");
    if (!productDescription) errors.push("Description is required");
    if (unitPrice === null || unitPrice < 0) errors.push("Valid unit price is required");
    if (packageQuantity <= 0) errors.push("Package quantity must be greater than zero");
    if (contractorPrice !== null && contractorPrice < 0) errors.push("Contractor price cannot be negative");

    return {
      rowNumber: rowIndex + 2,
      supplierSku,
      productDescription,
      manufacturer: valueAt(record, columns.manufacturer),
      modelNumber: valueAt(record, columns.modelNumber),
      packageQuantity,
      unitOfMeasure: valueAt(record, columns.unitOfMeasure) || "each",
      unitPrice: unitPrice ?? 0,
      contractorPrice,
      availability: valueAt(record, columns.availability),
      sourceRow: Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ""])),
      errors,
    };
  });

  const skuCounts = new Map<string, number>();
  for (const row of rows) {
    const sku = row.supplierSku.toLowerCase();
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) ?? 0) + 1);
  }
  const duplicateSkus = [...skuCounts.entries()].filter(([, count]) => count > 1).map(([sku]) => sku);
  for (const row of rows) {
    if (duplicateSkus.includes(row.supplierSku.toLowerCase())) row.errors.push("Duplicate SKU in this file");
  }

  return { rows, duplicateSkus, headers };
}

export function getEffectiveSupplierPrice(row: Pick<SupplierPriceImportRow, "unitPrice" | "contractorPrice">) {
  return row.contractorPrice ?? row.unitPrice;
}
