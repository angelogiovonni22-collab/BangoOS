import type { Database } from "@/types/database.types";

export const LABOR_RATE_STATUSES = ["active", "inactive", "archived"] as const;
export type LaborRateStatus = (typeof LABOR_RATE_STATUSES)[number];

export const SKILL_LEVELS = ["apprentice", "helper", "journeyman", "foreman", "superintendent", "specialist", "other"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const EMPLOYMENT_TYPES = ["employee", "temporary", "subcontracted_labor", "other"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const UNION_STATUSES = ["union", "non_union", "prevailing_wage", "not_applicable"] as const;
export type UnionStatus = (typeof UNION_STATUSES)[number];

export const WORKER_CLASSIFICATIONS = ["w2", "1099", "temporary", "other"] as const;
export type WorkerClassification = (typeof WORKER_CLASSIFICATIONS)[number];

export const PRODUCTION_PERIODS = ["hour", "day", "shift"] as const;
export type ProductionPeriod = (typeof PRODUCTION_PERIODS)[number];

export type LaborRateSortKey =
  | "code_asc"
  | "name_asc"
  | "trade_asc"
  | "base_hourly_rate_desc"
  | "true_hourly_cost_desc"
  | "billable_hourly_rate_desc"
  | "updated_at_desc";

export type LaborRateRow = Database["public"]["Tables"]["labor_rates"]["Row"];

export type CostCodeOption = {
  id: string;
  code: string;
  name: string;
};

export type LaborRateListItem = {
  id: string;
  code: string;
  name: string;
  trade: string | null;
  skillLevel: SkillLevel | null;
  baseHourlyRate: number;
  totalBurdenHourly: number;
  trueHourlyCost: number;
  billableHourlyRate: number;
  status: LaborRateStatus;
  unionStatus: UnionStatus | null;
  workerClassification: WorkerClassification | null;
  defaultCostCodeId: string | null;
  defaultCostCodeLabel: string | null;
  updatedAt: string;
};

export type LaborRateFormInput = {
  code: string;
  name: string;
  description: string;
  status: LaborRateStatus;
  trade: string;
  position_title: string;
  skill_level: SkillLevel | "";
  employment_type: EmploymentType | "";
  union_status: UnionStatus | "";
  worker_classification: WorkerClassification | "";
  default_cost_code_id: string;
  currency_code: string;

  base_hourly_rate: string;
  overtime_multiplier: string;
  double_time_multiplier: string;
  weekend_multiplier: string;
  holiday_multiplier: string;
  shift_differential: string;
  bonus_hourly_allocation: string;

  payroll_tax_hourly: string;
  workers_comp_hourly: string;
  health_insurance_hourly: string;
  retirement_hourly: string;
  paid_time_off_hourly: string;
  training_hourly: string;
  vehicle_allowance_hourly: string;
  phone_allowance_hourly: string;
  tool_allowance_hourly: string;
  uniform_hourly: string;
  other_burden_hourly: string;

  overhead_markup_percent: string;
  profit_markup_percent: string;

  production_unit: string;
  production_rate: string;
  production_period: ProductionPeriod | "";
  crew_size: string;
  notes: string;
};

export const EMPTY_LABOR_RATE_FORM: LaborRateFormInput = {
  code: "",
  name: "",
  description: "",
  status: "active",
  trade: "",
  position_title: "",
  skill_level: "",
  employment_type: "",
  union_status: "",
  worker_classification: "",
  default_cost_code_id: "",
  currency_code: "USD",

  base_hourly_rate: "0",
  overtime_multiplier: "1.5",
  double_time_multiplier: "2",
  weekend_multiplier: "1",
  holiday_multiplier: "2",
  shift_differential: "0",
  bonus_hourly_allocation: "0",

  payroll_tax_hourly: "0",
  workers_comp_hourly: "0",
  health_insurance_hourly: "0",
  retirement_hourly: "0",
  paid_time_off_hourly: "0",
  training_hourly: "0",
  vehicle_allowance_hourly: "0",
  phone_allowance_hourly: "0",
  tool_allowance_hourly: "0",
  uniform_hourly: "0",
  other_burden_hourly: "0",

  overhead_markup_percent: "0",
  profit_markup_percent: "0",

  production_unit: "",
  production_rate: "",
  production_period: "",
  crew_size: "",
  notes: "",
};
