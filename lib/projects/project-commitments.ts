export type CompensationMethod = "payroll_rate" | "hourly" | "day_rate" | "piece_rate" | "lump_sum" | "prevailing_wage";

export type LaborCommitmentInput = {
  method: CompensationMethod;
  rate: number;
  projectedHours?: number;
  projectedDays?: number;
  projectedUnits?: number;
  lumpSumAmount?: number;
  actualHours?: number;
  actualDays?: number;
  actualUnits?: number;
  actualCostOverride?: number | null;
};

export type ProjectCommitmentSummary = {
  laborProjected: number;
  laborActual: number;
  subcontractCommitted: number;
  totalCommitted: number;
  budgetRemainingAfterCommitments: number | null;
};

const money = (value: number) => Math.round(Math.max(0, value) * 100) / 100;

export function calculateLaborCost(input: LaborCommitmentInput, actual = false) {
  if (actual && input.actualCostOverride != null) return money(input.actualCostOverride);
  const rate = Math.max(0, input.rate || 0);
  if (input.method === "lump_sum") return actual ? 0 : money(input.lumpSumAmount || 0);
  if (input.method === "day_rate") return money(Math.max(0, (actual ? input.actualDays : input.projectedDays) || 0) * rate);
  if (input.method === "piece_rate") return money(Math.max(0, (actual ? input.actualUnits : input.projectedUnits) || 0) * rate);
  return money(Math.max(0, (actual ? input.actualHours : input.projectedHours) || 0) * rate);
}

export function summarizeProjectCommitments(input: {
  budget: number | null;
  labor: LaborCommitmentInput[];
  signedSubcontracts: Array<{ amount: number | null; status: string }>;
}): ProjectCommitmentSummary {
  const laborProjected = money(input.labor.reduce((sum, item) => sum + calculateLaborCost(item), 0));
  const laborActual = money(input.labor.reduce((sum, item) => sum + calculateLaborCost(item, true), 0));
  const subcontractCommitted = money(input.signedSubcontracts
    .filter((item) => ["signed", "closed"].includes(item.status))
    .reduce((sum, item) => sum + Math.max(0, item.amount || 0), 0));
  const totalCommitted = money(laborProjected + subcontractCommitted);
  return {
    laborProjected,
    laborActual,
    subcontractCommitted,
    totalCommitted,
    budgetRemainingAfterCommitments: input.budget === null ? null : Math.round((input.budget - totalCommitted) * 100) / 100,
  };
}

export function compensationMethodLabel(method: CompensationMethod) {
  return ({
    payroll_rate: "Payroll rates",
    hourly: "Hourly",
    day_rate: "Day rate",
    piece_rate: "Piece / unit rate",
    lump_sum: "Lump sum",
    prevailing_wage: "Prevailing wage",
  } as const)[method];
}
