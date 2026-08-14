import type { DashboardMetric } from "@/lib/dashboard/types";
import { deriveExecutiveReadinessState } from "./executive-status";
import { rankExecutivePriorityItems } from "./executive-priority-engine";
import type {
  ExecutiveBriefBuildInput,
  ExecutiveCommandDefinition,
  ExecutiveHealthSummary,
  ExecutiveLimitation,
  ExecutiveNotification,
  ExecutivePriorityItem,
  ExecutiveSummaryItem,
} from "./executive-brief-types";

export function buildExecutiveGreeting(input: ExecutiveBriefBuildInput) {
  const greetingKey = input.now.getHours() < 12
    ? "dashboard.greetingMorning"
    : input.now.getHours() < 18
      ? "dashboard.greetingAfternoon"
      : "dashboard.greetingEvening";

  return {
    eyebrow: input.t("orion.executiveEyebrow"),
    title: `${input.t(greetingKey)}, ${input.companyName || input.t("common.appName")}`,
    description: input.t("orion.executiveDescription"),
  };
}

export function buildExecutiveCompanySummary(input: ExecutiveBriefBuildInput) {
  const activeProjects = getMetric(input.dashboardData.metrics, "active-projects");
  const assignedActiveWork = getMetric(input.dashboardData.metrics, "assigned-active-work");
  const openEstimates = getMetric(input.dashboardData.metrics, "open-estimates");
  const openInvoices = getMetric(input.dashboardData.metrics, "open-invoices");

  return {
    headline: input.t("orion.companySummaryHeadline", {
      company: input.companyName || input.t("common.appName"),
      activeProjects: activeProjects?.value ?? 0,
      openEstimates: openEstimates?.value ?? 0,
    }),
    items: [
      toSummaryItem(activeProjects, input),
      toSummaryItem(assignedActiveWork, input),
      toSummaryItem(openEstimates, input),
      toSummaryItem(openInvoices, input),
      {
        id: "memory-count",
        label: input.t("orion.memoryCoverage"),
        value: String(input.memorySummary.memoryCount),
        href: "/settings/memory-review",
        tone: input.memorySummary.memoryCount > 0 ? "success" : "muted",
      },
    ].filter((item): item is ExecutiveSummaryItem => Boolean(item)),
  };
}

export function buildExecutiveHealthSummary(input: ExecutiveBriefBuildInput): ExecutiveHealthSummary {
  const businessSummary = input.dashboardData.businessSummary;
  const scoreMetric = getMetric(input.dashboardData.metrics, "health-score");
  const items: ExecutiveSummaryItem[] = [
    {
      id: "health-score",
      label: input.t("orion.companyHealth"),
      value: scoreMetric ? `${scoreMetric.value}/100` : "0/100",
      href: "/dashboard",
      tone: scoreMetric && scoreMetric.value >= 80 ? "success" : "warning",
    },
    {
      id: "on-schedule",
      label: input.t("dashboard.projectOnSchedule"),
      value: String(input.dashboardData.projectHealth.onScheduleCount),
      href: "/projects",
      tone: "success",
    },
    {
      id: "at-risk",
      label: input.t("dashboard.projectAtRisk"),
      value: String(input.dashboardData.projectHealth.atRiskCount),
      href: "/projects",
      tone: input.dashboardData.projectHealth.atRiskCount > 0 ? "warning" : "muted",
    },
    {
      id: "behind",
      label: input.t("dashboard.projectBehindSchedule"),
      value: String(input.dashboardData.projectHealth.behindScheduleCount),
      href: "/projects",
      tone: input.dashboardData.projectHealth.behindScheduleCount > 0 ? "warning" : "muted",
    },
  ];

  if (businessSummary?.items?.length) {
    items.push({
      id: "operations-state",
      label: input.t("orion.operationsReadiness"),
      value: businessSummary.items.filter((item) => item.state === "healthy").length.toString(),
      href: "/dashboard",
      tone: businessSummary.items.some((item) => item.state === "attention") ? "warning" : "success",
    });
  }

  const limitations = buildExecutiveLimitations(input);
  const priorityItems = buildExecutivePriorityItems(input);

  return {
    headline: input.t("orion.healthSummaryHeadline"),
    state: deriveExecutiveReadinessState({
      sectionErrors: input.dashboardSectionErrors,
      limitations,
      priorityItems,
    }),
    items,
  };
}

export function buildExecutivePriorityItems(input: ExecutiveBriefBuildInput): ExecutivePriorityItem[] {
  const dashboardItems: ExecutivePriorityItem[] = input.dashboardData.recommendations.map((recommendation) => ({
    id: recommendation.id,
    title: input.t(`dashboard.priority${toTitle(recommendation.priority)}`),
    description: input.t(recommendation.messageKey),
    severity: recommendation.priority,
    category: recommendation.icon === "I" ? "budget" : recommendation.icon === "CO" ? "operations" : "schedule",
    affectedCount: null,
    href: recommendation.icon === "I" ? "/invoices" : recommendation.icon === "CO" ? "/change-orders" : "/projects",
    source: "dashboard",
    score: 0,
  }));

  const memoryItems: ExecutivePriorityItem[] = input.memorySummary.knownRisks.slice(0, 2).map((risk, index) => ({
    id: `memory-risk-${index}`,
    title: input.t("orion.priorityMemoryRiskTitle"),
    description: risk,
    severity: "medium",
    category: "documentation",
    affectedCount: input.memorySummary.knownRisks.length,
    href: "/settings/memory-review",
    source: "memory",
    score: 0,
  }));

  const learningItems: ExecutivePriorityItem[] = input.learning.snapshot.limitations.slice(0, 1).map((limitation, index) => ({
    id: `learning-limitation-${index}`,
    title: input.t("orion.priorityLearningTitle"),
    description: limitation,
    severity: "low",
    category: "operations",
    affectedCount: null,
    href: "/dashboard",
    source: "learning",
    score: 0,
  }));

  return rankExecutivePriorityItems([...dashboardItems, ...memoryItems, ...learningItems]).slice(0, 4);
}

export function buildExecutiveNotifications(input: ExecutiveBriefBuildInput): ExecutiveNotification[] {
  const notifications: ExecutiveNotification[] = [];

  if (input.dashboardData.weather === null) {
    notifications.push({
      id: "weather-unavailable",
      tone: "info",
      message: input.t("orion.notificationWeatherUnavailable"),
    });
  }

  if (input.dashboardData.metrics.some((metric) => metric.displayValueKey === "dashboard.metricRestrictedValue")) {
    notifications.push({
      id: "financial-restricted",
      tone: "warning",
      message: input.t("orion.notificationFinancialRestricted"),
    });
  }

  if (input.memorySummary.topLessons.length > 0) {
    notifications.push({
      id: "memory-lessons",
      tone: "success",
      message: input.t("orion.notificationLessons", { count: input.memorySummary.topLessons.length }),
    });
  }

  if (input.learning.companyDNA.traits.length > 0) {
    notifications.push({
      id: "learning-traits",
      tone: "info",
      message: input.t("orion.notificationLearningTraits", { count: input.learning.companyDNA.traits.length }),
    });
  }

  for (const message of Object.values(input.dashboardSectionErrors).filter(Boolean).slice(0, 2)) {
    notifications.push({
      id: `section-${notifications.length}`,
      tone: "warning",
      message,
    });
  }

  return notifications.slice(0, 4);
}

export function buildExecutiveLimitations(input: ExecutiveBriefBuildInput): ExecutiveLimitation[] {
  const limitations: ExecutiveLimitation[] = [];

  if (input.dashboardData.weather === null) {
    limitations.push({ id: "weather", message: input.t("orion.limitationWeather") });
  }

  limitations.push({ id: "daily-reports", message: input.t("orion.limitationDailyReports") });
  limitations.push({ id: "attendance", message: input.t("orion.limitationAttendance") });

  for (const limitation of input.learning.snapshot.limitations.slice(0, 2)) {
    limitations.push({ id: `learning-${limitations.length}`, message: limitation });
  }

  return uniqueLimitations(limitations).slice(0, 5);
}

export function buildExecutiveQuickCommands(t: ExecutiveBriefBuildInput["t"]): ExecutiveCommandDefinition[] {
  return [
    { id: "overdue-tasks", label: t("orion.commandOverdueTasks"), example: "Show overdue tasks", href: "/projects" },
    { id: "overdue-invoices", label: t("orion.commandOverdueInvoices"), example: "Show overdue invoices", href: "/invoices" },
    { id: "active-projects", label: t("orion.commandActiveProjects"), example: "Show active projects", href: "/projects" },
    { id: "blocked-tasks", label: t("orion.commandBlockedTasks"), example: "Show blocked tasks", href: "/projects" },
  ];
}

function toSummaryItem(metric: DashboardMetric | undefined, input: ExecutiveBriefBuildInput): ExecutiveSummaryItem | null {
  if (!metric) {
    return null;
  }

  return {
    id: metric.id,
    label: input.t(metric.titleKey),
    value: metric.displayValueKey ? input.t(metric.displayValueKey) : formatMetricValue(metric, input.localeTag),
    href: metric.href,
    tone: metric.displayValueKey ? "muted" : "default",
  };
}

function formatMetricValue(metric: DashboardMetric, localeTag: string) {
  if (metric.valueKind === "currency") {
    return new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(metric.value);
  }

  if (metric.valueKind === "score") {
    return `${metric.value}/100`;
  }

  return new Intl.NumberFormat(localeTag).format(metric.value);
}

function getMetric(metrics: DashboardMetric[], id: string) {
  return metrics.find((metric) => metric.id === id);
}

function uniqueLimitations(items: ExecutiveLimitation[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.message)) {
      return false;
    }

    seen.add(item.message);
    return true;
  });
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}