import {
  EMPLOYMENT_TYPES,
  PRODUCTION_PERIODS,
  SKILL_LEVELS,
  UNION_STATUSES,
  WORKER_CLASSIFICATIONS,
  type LaborRateFormInput,
  type LaborRateStatus,
} from "./types";

export type LaborRateCalculationSummary = {
  baseRate: number;
  totalBurdenHourly: number;
  trueHourlyCost: number;
  overtimePayRate: number;
  doubleTimePayRate: number;
  weekendPayRate: number;
  holidayPayRate: number;
  billableHourlyRate: number;
  burdenPercentage: number;
  grossMarginPerHour: number;
};

export type LaborRateValidationResult = {
  isValid: boolean;
  errors: string[];
  calculations: LaborRateCalculationSummary;
};

const USD_CURRENCY = "USD";

function isValidStatus(value: string): value is LaborRateStatus {
  return ["active", "inactive", "archived"].includes(value);
}

function isInSet(value: string, allowedValues: readonly string[]) {
  return allowedValues.includes(value);
}

function parseNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundTo(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function roundMoney(value: number) {
  return roundTo(value, 4);
}

function roundPercent(value: number) {
  return roundTo(value, 4);
}

export function formatUsdCurrency(value: number, currencyCode = USD_CURRENCY) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode || USD_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${roundTo(value, 2).toFixed(2)}%`;
}

export function calculateTotalBurdenHourly(input: LaborRateFormInput) {
  const burdenFields = [
    input.payroll_tax_hourly,
    input.workers_comp_hourly,
    input.health_insurance_hourly,
    input.retirement_hourly,
    input.paid_time_off_hourly,
    input.training_hourly,
    input.vehicle_allowance_hourly,
    input.phone_allowance_hourly,
    input.tool_allowance_hourly,
    input.uniform_hourly,
    input.other_burden_hourly,
  ];

  const total = burdenFields.reduce((sum, current) => sum + parseNumber(current, 0), 0);
  return roundMoney(total);
}

export function calculateTrueHourlyCost(input: LaborRateFormInput, totalBurdenHourly: number) {
  const trueCost = parseNumber(input.base_hourly_rate, 0)
    + parseNumber(input.shift_differential, 0)
    + parseNumber(input.bonus_hourly_allocation, 0)
    + totalBurdenHourly;

  return roundMoney(trueCost);
}

function calculatePayRate(baseRate: number, multiplier: number) {
  return roundMoney(baseRate * multiplier);
}

export function calculateOvertimePayRate(input: LaborRateFormInput) {
  return calculatePayRate(parseNumber(input.base_hourly_rate, 0), parseNumber(input.overtime_multiplier, 1.5));
}

export function calculateDoubleTimePayRate(input: LaborRateFormInput) {
  return calculatePayRate(parseNumber(input.base_hourly_rate, 0), parseNumber(input.double_time_multiplier, 2));
}

export function calculateWeekendPayRate(input: LaborRateFormInput) {
  return calculatePayRate(parseNumber(input.base_hourly_rate, 0), parseNumber(input.weekend_multiplier, 1));
}

export function calculateHolidayPayRate(input: LaborRateFormInput) {
  return calculatePayRate(parseNumber(input.base_hourly_rate, 0), parseNumber(input.holiday_multiplier, 2));
}

// Markup method: additive percentages against true hourly cost.
// billable = trueHourlyCost * (1 + overhead% + profit%).
export function calculateBillableHourlyRate(input: LaborRateFormInput, trueHourlyCost: number) {
  const overheadDecimal = parseNumber(input.overhead_markup_percent, 0) / 100;
  const profitDecimal = parseNumber(input.profit_markup_percent, 0) / 100;
  const billable = trueHourlyCost * (1 + overheadDecimal + profitDecimal);

  return roundMoney(billable);
}

export function calculateBurdenPercentage(input: LaborRateFormInput, totalBurdenHourly: number) {
  const baseRate = parseNumber(input.base_hourly_rate, 0);

  if (baseRate <= 0) {
    return 0;
  }

  return roundPercent((totalBurdenHourly / baseRate) * 100);
}

export function calculateLaborRateSummary(input: LaborRateFormInput): LaborRateCalculationSummary {
  const baseRate = roundMoney(parseNumber(input.base_hourly_rate, 0));
  const totalBurdenHourly = calculateTotalBurdenHourly(input);
  const trueHourlyCost = calculateTrueHourlyCost(input, totalBurdenHourly);
  const overtimePayRate = calculateOvertimePayRate(input);
  const doubleTimePayRate = calculateDoubleTimePayRate(input);
  const weekendPayRate = calculateWeekendPayRate(input);
  const holidayPayRate = calculateHolidayPayRate(input);
  const billableHourlyRate = calculateBillableHourlyRate(input, trueHourlyCost);
  const burdenPercentage = calculateBurdenPercentage(input, totalBurdenHourly);
  const grossMarginPerHour = roundMoney(billableHourlyRate - trueHourlyCost);

  return {
    baseRate,
    totalBurdenHourly,
    trueHourlyCost,
    overtimePayRate,
    doubleTimePayRate,
    weekendPayRate,
    holidayPayRate,
    billableHourlyRate,
    burdenPercentage,
    grossMarginPerHour,
  };
}

function isNonNegativeNumberString(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function isNumberInRange(value: string, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

export function validateLaborRateInput(
  input: LaborRateFormInput,
  options?: {
    allowedCostCodeIds?: string[];
  },
): LaborRateValidationResult {
  const errors: string[] = [];
  const calculations = calculateLaborRateSummary(input);

  if (!input.code.trim()) {
    errors.push("Labor rate code is required.");
  }

  if (!input.name.trim()) {
    errors.push("Labor rate name is required.");
  }

  if (!isValidStatus(input.status)) {
    errors.push("Status is invalid.");
  }

  if (!isNonNegativeNumberString(input.base_hourly_rate)) {
    errors.push("Base hourly rate must be a non-negative number.");
  }

  if (!isNumberInRange(input.overtime_multiplier, 1, 10)) {
    errors.push("Overtime multiplier must be between 1 and 10.");
  }

  if (!isNumberInRange(input.double_time_multiplier, 1, 10)) {
    errors.push("Double-time multiplier must be between 1 and 10.");
  }

  if (!isNumberInRange(input.weekend_multiplier, 0, 10)) {
    errors.push("Weekend multiplier must be between 0 and 10.");
  }

  if (!isNumberInRange(input.holiday_multiplier, 0, 10)) {
    errors.push("Holiday multiplier must be between 0 and 10.");
  }

  const nonNegativeMoneyFields = [
    ["Shift differential", input.shift_differential],
    ["Bonus hourly allocation", input.bonus_hourly_allocation],
    ["Payroll tax hourly", input.payroll_tax_hourly],
    ["Workers comp hourly", input.workers_comp_hourly],
    ["Health insurance hourly", input.health_insurance_hourly],
    ["Retirement hourly", input.retirement_hourly],
    ["Paid time off hourly", input.paid_time_off_hourly],
    ["Training hourly", input.training_hourly],
    ["Vehicle allowance hourly", input.vehicle_allowance_hourly],
    ["Phone allowance hourly", input.phone_allowance_hourly],
    ["Tool allowance hourly", input.tool_allowance_hourly],
    ["Uniform hourly", input.uniform_hourly],
    ["Other burden hourly", input.other_burden_hourly],
  ] as const;

  for (const [label, value] of nonNegativeMoneyFields) {
    if (!isNonNegativeNumberString(value)) {
      errors.push(`${label} must be a non-negative number.`);
    }
  }

  if (!isNumberInRange(input.overhead_markup_percent, 0, 500)) {
    errors.push("Overhead markup percent must be between 0 and 500.");
  }

  if (!isNumberInRange(input.profit_markup_percent, 0, 500)) {
    errors.push("Profit markup percent must be between 0 and 500.");
  }

  if (input.skill_level && !isInSet(input.skill_level, SKILL_LEVELS)) {
    errors.push("Skill level is invalid.");
  }

  if (input.employment_type && !isInSet(input.employment_type, EMPLOYMENT_TYPES)) {
    errors.push("Employment type is invalid.");
  }

  if (input.union_status && !isInSet(input.union_status, UNION_STATUSES)) {
    errors.push("Union status is invalid.");
  }

  if (input.worker_classification && !isInSet(input.worker_classification, WORKER_CLASSIFICATIONS)) {
    errors.push("Worker classification is invalid.");
  }

  if (input.production_period && !isInSet(input.production_period, PRODUCTION_PERIODS)) {
    errors.push("Production period is invalid.");
  }

  if (input.production_rate.trim() && !isNonNegativeNumberString(input.production_rate)) {
    errors.push("Production rate must be a non-negative number.");
  }

  if (input.crew_size.trim()) {
    const crewSize = Number(input.crew_size);

    if (!Number.isFinite(crewSize) || crewSize <= 0) {
      errors.push("Crew size must be a positive number when provided.");
    }
  }

  if (!input.currency_code.trim() || !/^[A-Z]{3}$/.test(input.currency_code.trim())) {
    errors.push("Currency code must be a valid 3-letter code.");
  }

  if (input.default_cost_code_id && options?.allowedCostCodeIds && !options.allowedCostCodeIds.includes(input.default_cost_code_id)) {
    errors.push("Default cost code must belong to your company.");
  }

  return {
    isValid: errors.length === 0,
    errors,
    calculations,
  };
}
