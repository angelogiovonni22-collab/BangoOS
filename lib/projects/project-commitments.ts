export type CompensationMethod = "hourly" | "salary" | "day_rate" | "piece_rate";

export type LaborCommitmentInput = {
  method: CompensationMethod;
  rate: number;
  projectedHours?: number;
  projectedDays?: number;
  projectedUnits?: number;
  actualHours?: number;
  actualDays?: number;
  actualUnits?: number;
  annualHours?: number;
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
  const rate = Math.max(0, input.rate);
  if (input.method === "salary") {
    const hours = actual ? input.actualHours : input.projectedHours;
    return money((Math.max(0, hours || 0) / Math.max(1, input.annualHours || 2080)) * rate);
  }
  if (input.method === "day_rate") {
    return money(Math.max(0, (actual ? input.actualDays : input.projectedDays) || 0) * rate);
  }
  if (input.method === "piece_rate") {
    return money(Math.max(0, (actual ? input.actualUnits : input.projectedUnits) || 0) * rate);
  }
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
    budgetRemainingAfterCommitments: input.budget === null ? null : money(input.budget - totalCommitted),
  };
}
