import type { Database } from "@/types/database.types";

export const UNIT_CATEGORIES = [
  "count",
  "time",
  "length",
  "area",
  "volume",
  "weight",
  "mass",
  "liquid",
  "material",
  "packaging",
  "equipment",
  "labor",
  "temperature",
  "currency",
  "percentage",
  "other",
] as const;

export const UNIT_MEASUREMENT_SYSTEMS = ["universal", "imperial", "metric", "custom"] as const;

export const UNIT_TYPES = ["standard", "derived", "packaging", "custom"] as const;

export const UNIT_SORT_KEYS = [
  "code_asc",
  "name_asc",
  "category_asc",
  "measurement_system_asc",
  "unit_type_asc",
  "is_system_desc",
  "sort_order_asc",
  "updated_at_desc",
] as const;

export type UnitCategory = (typeof UNIT_CATEGORIES)[number];
export type UnitMeasurementSystem = (typeof UNIT_MEASUREMENT_SYSTEMS)[number];
export type UnitType = (typeof UNIT_TYPES)[number];
export type UnitSortKey = (typeof UNIT_SORT_KEYS)[number];

export type UnitOfMeasureRow = Database["public"]["Tables"]["units_of_measure"]["Row"];
export type UnitOfMeasureInsert = Database["public"]["Tables"]["units_of_measure"]["Insert"];
export type UnitOfMeasureUpdate = Database["public"]["Tables"]["units_of_measure"]["Update"];

export type UnitListItem = Pick<
  UnitOfMeasureRow,
  | "id"
  | "code"
  | "name"
  | "plural_name"
  | "symbol"
  | "category"
  | "measurement_system"
  | "unit_type"
  | "base_unit_id"
  | "conversion_factor"
  | "decimal_precision"
  | "is_system"
  | "is_active"
  | "sort_order"
  | "updated_at"
> & {
  sourceLabel: "System" | "Company";
  baseUnitCode: string | null;
  baseUnitName: string | null;
};

export type UnitFormValues = {
  code: string;
  name: string;
  plural_name: string;
  symbol: string;
  description: string;
  category: UnitCategory;
  measurement_system: UnitMeasurementSystem;
  unit_type: UnitType;
  base_unit_id: string;
  conversion_factor: string;
  decimal_precision: string;
  allow_fractional_quantity: boolean;
  is_active: boolean;
  sort_order: string;
  notes: string;
};

export const EMPTY_UNIT_FORM: UnitFormValues = {
  code: "",
  name: "",
  plural_name: "",
  symbol: "",
  description: "",
  category: "count",
  measurement_system: "universal",
  unit_type: "standard",
  base_unit_id: "",
  conversion_factor: "",
  decimal_precision: "2",
  allow_fractional_quantity: true,
  is_active: true,
  sort_order: "0",
  notes: "",
};

export type UnitFilterSource = "all" | "system" | "company";
export type UnitFilterActive = "all" | "active" | "inactive";
export type UnitFilterFractional = "all" | "fractional" | "whole_only";
export type UnitFilterHasConversion = "all" | "with_conversion" | "without_conversion";

export type UnitListFilters = {
  query: string;
  category: UnitCategory | "all";
  measurementSystem: UnitMeasurementSystem | "all";
  unitType: UnitType | "all";
  source: UnitFilterSource;
  active: UnitFilterActive;
  fractional: UnitFilterFractional;
  hasConversion: UnitFilterHasConversion;
  baseUnitId: string;
  sortBy: UnitSortKey;
  page: number;
  pageSize: number;
};

export type ConversionPreviewResult = {
  isValid: boolean;
  message: string;
  oneUnitText: string | null;
  sampleText: string | null;
};

export type ConvertibleUnit = Pick<
  UnitOfMeasureRow,
  "id" | "code" | "name" | "symbol" | "base_unit_id" | "conversion_factor" | "decimal_precision"
>;

export type UnitUsageCount = {
  table: string;
  column: string;
  count: number;
};

export type UnitUsageSummary = {
  totalReferences: number;
  references: UnitUsageCount[];
};
