import type { OrionCommandCenterAction, OrionWorkspaceContext } from "./types";

function compactText(value: string) {
  return value.trim().toLowerCase();
}

function includesToken(haystack: string, token: string) {
  return haystack.includes(token);
}

function contextActionBoost(action: OrionCommandCenterAction, context: OrionWorkspaceContext) {
  let score = 0;

  const focus = context.focusArea;
  if (focus === "project") {
    const prioritized = new Set([
      "project.open_budget",
      "route-project-timeline",
      "route-project-change-order",
      "project.assign_crew",
      "route-project-daily-report",
      "route-project-health",
      "route-project-photos",
      "route-project-documents",
    ]);

    if (prioritized.has(action.id) || prioritized.has(action.commandId)) {
      score += 120;
    }
  }

  if (focus === "estimate") {
    const prioritized = new Set([
      "estimate.send",
      "route-estimate-preview",
      "route-estimate-customer-portal",
      "estimate.generate_deposit_invoice",
      "estimate.convert",
      "route-estimate-approval-status",
    ]);

    if (prioritized.has(action.id) || prioritized.has(action.commandId)) {
      score += 120;
    }
  }

  if (focus === "customer") {
    const prioritized = new Set([
      "route-customer-create-estimate",
      "route-customer-create-project",
      "route-customer-timeline",
      "route-customer-balance",
      "route-customer-documents",
      "route-customer-call",
      "route-customer-email",
    ]);

    if (prioritized.has(action.id) || prioritized.has(action.commandId)) {
      score += 120;
    }
  }

  if (focus === "dashboard") {
    const prioritized = new Set([
      "route-dashboard-priorities",
      "route-dashboard-critical-alerts",
      "route-dashboard-overdue-estimates",
      "route-dashboard-cash-flow",
      "route-dashboard-recent-activity",
    ]);

    if (prioritized.has(action.id)) {
      score += 100;
    }
  }

  if (action.contextTags.includes(focus)) {
    score += 36;
  }

  if (context.currentRoute.startsWith("/timeline") && action.group === "reports") {
    score += 12;
  }

  return score;
}

function isRelevantToContext(action: OrionCommandCenterAction, context: OrionWorkspaceContext) {
  if (context.focusArea === "general") {
    return true;
  }

  if (action.contextTags.length === 0) {
    return true;
  }

  if (action.contextTags.includes(context.focusArea)) {
    return true;
  }

  if (action.group === "navigation") {
    return true;
  }

  return false;
}

export function rankActionsWithWorkspaceContext(params: {
  actions: OrionCommandCenterAction[];
  query: string;
  context: OrionWorkspaceContext;
  recentIds: string[];
  pinnedIds: string[];
}) {
  const tokens = compactText(params.query).split(/\s+/).filter(Boolean);

  return [...params.actions]
    .filter((action) => {
      if (tokens.length > 0) {
        return true;
      }

      return isRelevantToContext(action, params.context);
    })
    .map((action) => {
      let score = 0;
      const normalizedLabel = compactText(action.label);
      const normalizedSubtitle = compactText(action.subtitle);
      const keywordText = action.keywords.map((keyword) => compactText(keyword)).join(" ");

      if (params.pinnedIds.includes(action.id)) {
        score += 120;
      }

      const recentIndex = params.recentIds.indexOf(action.id);
      if (recentIndex >= 0) {
        score += 80 - recentIndex * 6;
      }

      score += contextActionBoost(action, params.context);

      if (tokens.length === 0 && action.group === "navigation") {
        score += 16;
      }

      for (const token of tokens) {
        if (includesToken(normalizedLabel, token)) {
          score += 40;
        }

        if (includesToken(normalizedSubtitle, token)) {
          score += 16;
        }

        if (includesToken(keywordText, token)) {
          score += 22;
        }

        if (includesToken(action.commandId, token)) {
          score += 18;
        }
      }

      return { action, score };
    })
    .filter((entry) => {
      if (tokens.length === 0) {
        return true;
      }

      return entry.score > 0;
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return a.action.label.localeCompare(b.action.label);
    })
    .map((entry) => entry.action);
}
