import type { WidgetId } from "./types";
import {
  collectNewEntityIds,
  hasAnimatedEntries,
  markEntranceAnimated,
  shouldAnimateEntranceOnce,
} from "@/lib/motion/replay-helpers";
import type { AIRecommendation, DashboardActivityItem, ProjectHealthRow } from "./types";

const WIDGET_SEQUENCE_RANK: Record<WidgetId, number> = {
  "business-score": 1,
  "command-center": 2,
  kpi: 3,
  "project-health": 4,
  schedule: 5,
  activity: 6,
  weather: 7,
};

export function getWidgetSequenceRank(widgetId: WidgetId): number {
  return WIDGET_SEQUENCE_RANK[widgetId] ?? 99;
}

export function collectNewDashboardIds(previousIds: Set<string>, nextIds: string[]): Record<string, true> {
  return collectNewEntityIds(previousIds, nextIds);
}

export function hasNewDashboardItems(newIds: Record<string, true>): boolean {
  return hasAnimatedEntries(newIds);
}

export function shouldAnimateDashboardEntranceOnce(key: string): boolean {
  return shouldAnimateEntranceOnce(key);
}

export function markDashboardEntranceAnimated(key: string): void {
  markEntranceAnimated(key);
}

export function buildRecommendationPulseKey(recommendation: AIRecommendation): string {
  return `${recommendation.id}-${recommendation.priority}`;
}

export function buildActivityPulseKey(item: DashboardActivityItem): string {
  return `${item.id}-${item.category}-${item.actionLabelKey}`;
}

export function buildProjectPulseKey(project: ProjectHealthRow): string {
  return `${project.id}-${project.riskIndicator}-${project.healthScore}`;
}

export function shouldShowDashboardPreviewDataBadge(options: {
  isMockData: boolean;
  forceVisible?: boolean;
  nodeEnv?: string;
}): boolean {
  if (!options.isMockData) {
    return false;
  }

  if (options.forceVisible) {
    return true;
  }

  return options.nodeEnv !== "production";
}
