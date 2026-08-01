import { riskPriorityScore } from "@/lib/project-intelligence/briefing/priority-engine";
import type { ExecutivePriorityItem } from "./executive-brief-types";

const SOURCE_MODIFIER: Record<ExecutivePriorityItem["source"], number> = {
  dashboard: 0,
  memory: 8,
  learning: 16,
};

export function rankExecutivePriorityItems(items: ExecutivePriorityItem[]): ExecutivePriorityItem[] {
  return [...items]
    .map((item) => ({
      ...item,
      score: riskPriorityScore(item.severity, item.affectedCount, toRiskCategory(item.category)) + SOURCE_MODIFIER[item.source],
    }))
    .sort((left, right) => left.score - right.score || left.title.localeCompare(right.title));
}

function toRiskCategory(category: ExecutivePriorityItem["category"]) {
  if (category === "operations") {
    return "progress";
  }

  return category;
}