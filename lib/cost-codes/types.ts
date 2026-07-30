import type { Database } from "@/types/database.types";

export const COST_CODE_STATUSES = ["active", "inactive", "archived"] as const;
export type CostCodeStatus = (typeof COST_CODE_STATUSES)[number];

export type CostCodeSortKey =
  | "code_asc"
  | "name_asc"
  | "status_asc"
  | "budget_desc"
  | "actual_cost_desc"
  | "created_at_desc";

export type CostCodeRow = Database["public"]["Tables"]["cost_codes"]["Row"];

export type CostCodeFormInput = {
  code: string;
  name: string;
  description: string;
  status: CostCodeStatus;
  division: string;
  category: string;
  trade: string;
  parent_cost_code_id: string;
  default_labor_rate_id: string;
  default_material_category_id: string;
  default_equipment_category_id: string;
  budget: string;
  committed_cost: string;
  actual_cost: string;
};

export const EMPTY_COST_CODE_FORM: CostCodeFormInput = {
  code: "",
  name: "",
  description: "",
  status: "active",
  division: "",
  category: "",
  trade: "",
  parent_cost_code_id: "",
  default_labor_rate_id: "",
  default_material_category_id: "",
  default_equipment_category_id: "",
  budget: "0",
  committed_cost: "0",
  actual_cost: "0",
};

export type CostCodeParentOption = {
  id: string;
  code: string;
  name: string;
};

export type CostCodeListItem = {
  id: string;
  code: string;
  name: string;
  status: CostCodeStatus;
  division: string | null;
  category: string | null;
  trade: string | null;
  parentCostCodeId: string | null;
  parentLabel: string | null;
  hasChildren: boolean;
  budget: number;
  committedCost: number;
  actualCost: number;
  createdAt: string;
};
