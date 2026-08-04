"use client";

import { useMemo, type ReactNode } from "react";
import { FadeIn, MotionProvider } from "@/components/motion";
import {
  ActivityFeed,
  AICommandCenter,
  AutomationQueueWidget,
  BusinessHealthWidget,
  BusinessScore,
  CriticalAlertsWidget,
  DashboardHeader,
  DashboardCustomizer,
  DecisionRecommendationsWidget,
  EstimatePipelineWidget,
  KPIGrid,
  PendingFollowupsWidget,
  ProjectHealth,
  RecentAutomationsWidget,
  RiskSummaryWidget,
  ScheduleWidget,
  TodaysDecisionsWidget,
  TopPrioritiesWidget,
  WeatherWidget,
} from "@/components/dashboard";
import { Button, Card, CardContent, ErrorState } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { getWidgetSequenceRank, shouldShowDashboardPreviewDataBadge } from "@/lib/dashboard/motion-helpers";
import { useDashboardLayout } from "@/lib/dashboard/use-dashboard-layout";
import { useExecutiveDashboard } from "@/lib/dashboard/use-executive-dashboard";
import type { DashboardMetric, WidgetId } from "@/lib/dashboard/types";
import { ExecutiveIntelligenceBar } from "@/components/orion/ExecutiveIntelligenceBar";

function getGreetingKey(currentHour: number) {
  if (currentHour < 12) {
    return "dashboard.greetingMorning";
  }

  if (currentHour < 18) {
    return "dashboard.greetingAfternoon";
  }

  return "dashboard.greetingEvening";
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

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { data, companyName, isLoading, errorMessage, isMockData, sectionErrors, workspaceContext } = useExecutiveDashboard();
  const {
    layout,
    visibleWidgetOrder,
    toggleWidgetVisibility,
    toggleWidgetCollapsed,
    reorderWidgets,
    resetLayout,
  } = useDashboardLayout();

  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const now = new Date();
  const greeting = `${t(getGreetingKey(now.getHours()))}, ${t("common.welcomeBack")}`;
  const currentDate = new Intl.DateTimeFormat(localeTag, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const showPreviewDataBadge = shouldShowDashboardPreviewDataBadge({
    isMockData,
    forceVisible: process.env.NEXT_PUBLIC_DASHBOARD_SHOW_MOCK_BADGE === "true",
    nodeEnv: process.env.NODE_ENV,
  });

  const widgetClassById: Record<WidgetId, string> = {
    kpi: "xl:col-span-3",
    schedule: "xl:col-span-2",
    "project-health": "xl:col-span-1",
    weather: "xl:col-span-1",
    activity: "xl:col-span-2",
    "pending-followups": "xl:col-span-1",
    "automation-queue": "xl:col-span-1",
    "recent-automations": "xl:col-span-1",
    "estimate-pipeline": "xl:col-span-1",
    "top-priorities": "xl:col-span-1",
    "business-health": "xl:col-span-1",
    "risk-summary": "xl:col-span-1",
    "decision-recommendations": "xl:col-span-1",
    "todays-decisions": "xl:col-span-1",
    "critical-alerts": "xl:col-span-1",
    "business-score": "xl:col-span-1",
    "command-center": "xl:col-span-3",
  };

  const widgetContentById = useMemo<Record<WidgetId, ReactNode>>(
    () => ({
      kpi: (
        <KPIGrid
          metrics={data.metrics}
          localeTag={localeTag}
          isLoading={isLoading}
          isEmpty={data.metrics.length === 0}
          errorMessage={sectionErrors.kpi ?? null}
          formatValue={(metric) => metric.displayValueKey ? t(metric.displayValueKey) : formatMetricValue(metric, localeTag)}
          t={t}
        />
      ),
      schedule: <ScheduleWidget events={data.schedule} errorMessage={sectionErrors.schedule ?? null} t={t} />,
      "project-health": <ProjectHealth summary={data.projectHealth} errorMessage={sectionErrors["project-health"] ?? null} t={t} />,
      weather: <WeatherWidget weather={data.weather} errorMessage={sectionErrors.weather ?? null} t={t} />,
      activity: <ActivityFeed items={data.activities} isLoading={isLoading} errorMessage={sectionErrors.activity ?? null} t={t} />,
      "pending-followups": <PendingFollowupsWidget items={data.pendingFollowups} errorMessage={sectionErrors["pending-followups"] ?? null} t={t} />,
      "automation-queue": <AutomationQueueWidget items={data.automationQueue} errorMessage={sectionErrors["automation-queue"] ?? null} t={t} />,
      "recent-automations": <RecentAutomationsWidget items={data.recentAutomations} errorMessage={sectionErrors["recent-automations"] ?? null} t={t} />,
      "estimate-pipeline": <EstimatePipelineWidget pipeline={data.estimatePipeline} errorMessage={sectionErrors["estimate-pipeline"] ?? null} t={t} />,
      "top-priorities": <TopPrioritiesWidget items={data.topPriorities} t={t} />,
      "business-health": <BusinessHealthWidget items={data.businessHealth} briefing={data.morningBriefing} t={t} />,
      "risk-summary": <RiskSummaryWidget summary={data.riskSummary} t={t} />,
      "decision-recommendations": <DecisionRecommendationsWidget items={data.decisionRecommendations} t={t} />,
      "todays-decisions": <TodaysDecisionsWidget items={data.todaysDecisions} t={t} />,
      "critical-alerts": <CriticalAlertsWidget items={data.criticalAlerts} t={t} />,
      "business-score": <BusinessScore snapshot={data.businessScore} summary={data.businessSummary} isLoading={isLoading} errorMessage={sectionErrors["business-score"] ?? null} t={t} />,
      "command-center": <AICommandCenter recommendations={data.recommendations} isLoading={isLoading} errorMessage={sectionErrors["command-center"] ?? null} t={t} />,
    }),
    [data, isLoading, localeTag, sectionErrors, t],
  );

  const widgetTitleById = useMemo(
    () => new Map(data.widgetDefinitions.map((widget) => [widget.id, t(widget.titleKey)])),
    [data.widgetDefinitions, t],
  );

  if (errorMessage) {
    return <ErrorState compact title={t("dashboard.dashboardLoadError")} description={errorMessage} />;
  }

  return (
    <MotionProvider>
      <div className="space-y-6 overflow-x-hidden">
        <FadeIn delayMs={0} distancePx={4}>
          <DashboardHeader
            title={t("navigation.dashboard")}
            companyName={companyName || t("common.appName")}
            currentDate={currentDate}
            description={greeting}
            previewDataLabel={showPreviewDataBadge ? t("dashboard.previewData") : null}
            isReady={!isLoading}
            t={t}
            action={
              <DashboardCustomizer
                widgets={data.widgetDefinitions}
                layout={layout}
                t={t}
                onToggleVisibility={toggleWidgetVisibility}
                onToggleCollapsed={toggleWidgetCollapsed}
                onReorder={reorderWidgets}
                onReset={resetLayout}
              />
            }
          />
        </FadeIn>

        <ExecutiveIntelligenceBar
          companyName={companyName}
          workspaceContext={workspaceContext}
          dashboardData={data}
          dashboardSectionErrors={sectionErrors}
          isDashboardLoading={isLoading}
          localeTag={localeTag}
          t={t}
        />

        <section className="grid gap-6 xl:grid-cols-3">
          {visibleWidgetOrder.map((widgetId) => {
            const isCollapsed = layout.collapsed.includes(widgetId);
            const sequenceRank = getWidgetSequenceRank(widgetId);
            const delayMs = Math.min(260, sequenceRank * 28);

            if (isCollapsed) {
              return (
                <FadeIn key={widgetId} delayMs={delayMs} distancePx={5} className={widgetClassById[widgetId]}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {widgetTitleById.get(widgetId) || t("dashboard.widget")}
                      </p>
                      <Button size="sm" variant="outline" onClick={() => toggleWidgetCollapsed(widgetId)}>
                        {t("dashboard.expand")}
                      </Button>
                    </CardContent>
                  </Card>
                </FadeIn>
              );
            }

            return (
              <FadeIn key={widgetId} delayMs={delayMs} distancePx={5} className={widgetClassById[widgetId]}>
                {widgetContentById[widgetId]}
              </FadeIn>
            );
          })}
        </section>

        {visibleWidgetOrder.length === 0 ? (
          <ErrorState
            compact
            title={t("dashboard.noWidgetsVisible")}
            description={t("dashboard.noWidgetsVisibleDescription")}
          />
        ) : null}
      </div>
    </MotionProvider>
  );
}
