"use client";

import { useMemo, type ReactNode } from "react";
import {
  ActivityFeed,
  AICommandCenter,
  BusinessScore,
  DashboardHeader,
  DashboardCustomizer,
  KPIGrid,
  ProjectHealth,
  ScheduleWidget,
  WeatherWidget,
} from "@/components/dashboard";
import { Button, Card, CardContent, ErrorState } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { useDashboardLayout } from "@/lib/dashboard/use-dashboard-layout";
import { useExecutiveDashboard } from "@/lib/dashboard/use-executive-dashboard";
import type { DashboardMetric, WidgetId } from "@/lib/dashboard/types";

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
  const { data, companyName, isLoading, errorMessage } = useExecutiveDashboard();
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

  const widgetClassById: Record<WidgetId, string> = {
    kpi: "xl:col-span-3",
    schedule: "xl:col-span-2",
    "project-health": "xl:col-span-1",
    weather: "xl:col-span-1",
    activity: "xl:col-span-2",
    "business-score": "xl:col-span-1",
    "command-center": "xl:col-span-3",
  };

  const widgetContentById = useMemo<Record<WidgetId, ReactNode>>(
    () => ({
      kpi: (
        <KPIGrid
          metrics={data.metrics}
          isLoading={isLoading}
          isEmpty={data.metrics.length === 0}
          formatValue={(metric) => formatMetricValue(metric, localeTag)}
          t={t}
        />
      ),
      schedule: <ScheduleWidget events={data.schedule} t={t} />,
      "project-health": <ProjectHealth summary={data.projectHealth} t={t} />,
      weather: <WeatherWidget weather={data.weather} t={t} />,
      activity: <ActivityFeed items={data.activities} isLoading={isLoading} t={t} />,
      "business-score": <BusinessScore snapshot={data.businessScore} isLoading={isLoading} t={t} />,
      "command-center": <AICommandCenter recommendations={data.recommendations} isLoading={isLoading} t={t} />,
    }),
    [data, isLoading, localeTag, t],
  );

  const widgetTitleById = useMemo(
    () => new Map(data.widgetDefinitions.map((widget) => [widget.id, t(widget.titleKey)])),
    [data.widgetDefinitions, t],
  );

  if (errorMessage) {
    return <ErrorState compact title={t("dashboard.dashboardLoadError")} description={errorMessage} />;
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={t("navigation.dashboard")}
        companyName={companyName || t("common.appName")}
        currentDate={currentDate}
        description={greeting}
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

      <section className="grid gap-6 xl:grid-cols-3">
        {visibleWidgetOrder.map((widgetId) => {
          const isCollapsed = layout.collapsed.includes(widgetId);

          if (isCollapsed) {
            return (
              <Card key={widgetId} className={widgetClassById[widgetId]}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {widgetTitleById.get(widgetId) || t("dashboard.widget")}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => toggleWidgetCollapsed(widgetId)}>
                    {t("dashboard.expand")}
                  </Button>
                </CardContent>
              </Card>
            );
          }

          return (
            <div key={widgetId} className={widgetClassById[widgetId]}>
              {widgetContentById[widgetId]}
            </div>
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
  );
}
