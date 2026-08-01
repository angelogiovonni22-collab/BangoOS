import type { PriorityActionItem } from "./command-center-types";

const SEVERITY_SCORE: Record<PriorityActionItem["severity"], number> = {
  critical: 400,
  high: 300,
  medium: 200,
  low: 100,
};

const FOCUS_SCORE: Record<PriorityActionItem["focus"], number> = {
  critical: 0,
  today: 10,
  approvals: 20,
  projects: 30,
  workforce: 40,
  all: 50,
};

const MODULE_SCORE: Record<string, number> = {
  Tasks: 0,
  Projects: 10,
  Approvals: 20,
  Invoices: 30,
  Estimates: 40,
  Workforce: 50,
  SiteCam: 60,
};

export function computePriorityRank(item: Omit<PriorityActionItem, "rank">) {
  const ageScore = item.ageHours === null ? 0 : Math.min(48, Math.max(0, item.ageHours));
  const dueScore = item.dueAt ? 15 : 0;
  const moduleScore = MODULE_SCORE[item.sourceModule] ?? 99;

  return SEVERITY_SCORE[item.severity] - FOCUS_SCORE[item.focus] - moduleScore - dueScore - ageScore;
}

export function rankPriorityActionItems(items: Omit<PriorityActionItem, "rank">[]): PriorityActionItem[] {
  return items
    .map((item) => ({
      ...item,
      rank: computePriorityRank(item),
    }))
    .sort((left, right) => right.rank - left.rank || compareNullableDate(left.dueAt, right.dueAt) || left.title.localeCompare(right.title));
}

function compareNullableDate(left: string | null, right: string | null) {
  const leftValue = left ? new Date(left).getTime() : Number.MAX_SAFE_INTEGER;
  const rightValue = right ? new Date(right).getTime() : Number.MAX_SAFE_INTEGER;
  return leftValue - rightValue;
}