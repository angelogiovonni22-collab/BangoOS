"use client";

import { useEffect, useState } from "react";
import { FadeIn, MotionProvider } from "@/components/motion";
import {
  ActivityFeed,
  AICommandCenter,
  BusinessHealthWidget,
  CriticalAlertsWidget,
  DashboardHeader,
  KPIGrid,
  ProjectHealth,
  ScheduleWidget,
  TopPrioritiesWidget,
  WeatherWidget,
} from "@/components/dashboard";
import { Card, CardContent, ErrorState } from "@/components/ui";
import { ExecutiveIntelligenceBar } from "@/components/orion/ExecutiveIntelligenceBar";
import { useI18n } from "@/lib/i18n/provider";
import { shouldShowDashboardPreviewDataBadge } from "@/lib/dashboard/motion-helpers";
import { useExecutiveDashboard } from "@/lib/dashboard/use-executive-dashboard";
import type { DashboardMetric } from "@/lib/dashboard/types";

function getGreetingKey(currentHour: number) {
  if (currentHour < 12) return "dashboard.greetingMorning";
  if (currentHour < 18) return "dashboard.greetingAfternoon";
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
  if (metric.valueKind === "score") return `${metric.value}/100`;
  return new Intl.NumberFormat(localeTag).format(metric.value);
}

function SectionShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-default)] bg-[var(--color-surface-card)] shadow-[var(--shadow-soft)] ${className}`}>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { data, companyName, isLoading, errorMessage, isMockData, sectionErrors, workspaceContext } = useExecutiveDashboard();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const [localNow, setLocalNow] = useState<Date | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setLocalNow(new Date()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const greeting = localNow
    ? `${t(getGreetingKey(localNow.getHours()))}, ${t("common.welcomeBack")}`
    : t("common.welcomeBack");
  const currentDate = localNow
    ? new Intl.DateTimeFormat(localeTag, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(localNow)
    : "";
  const showPreviewDataBadge = shouldShowDashboardPreviewDataBadge({
    isMockData,
    forceVisible: process.env.NEXT_PUBLIC_DASHBOARD_SHOW_MOCK_BADGE === "true",
    nodeEnv: process.env.NODE_ENV,
  });

  if (errorMessage) {
    return <ErrorState compact title={t("dashboard.dashboardLoadError")} description={errorMessage} />;
  }

  return (
    <MotionProvider>
      <div className="container-page space-y-6 overflow-x-hidden pb-8">
        <FadeIn delayMs={0} distancePx={4}>
          <DashboardHeader
            title={t("navigation.dashboard")}
            companyName={companyName || t("common.appName")}
            currentDate={currentDate}
            description={greeting}
            previewDataLabel={showPreviewDataBadge ? t("dashboard.previewData") : null}
            isReady={!isLoading}
            t={t}
          />
        </FadeIn>

        <FadeIn delayMs={35} distancePx={5}>
          <section className="grid gap-5 xl:grid-cols-12" aria-label="B.O.S. command overview">
            <div className="min-w-0 xl:col-span-5">
              <SectionShell className="h-full bg-[linear-gradient(145deg,#071a33_0%,#0a2445_58%,#0d3158_100%)] [&_*]:border-white/10">
                <ProjectHealth summary={data.projectHealth} errorMessage={sectionErrors["project-health"] ?? null} t={t} />
              </SectionShell>
            </div>
            <div className="min-w-0 xl:col-span-4">
              <SectionShell className="h-full">
                <TopPrioritiesWidget items={data.topPriorities} t={t} />
              </SectionShell>
            </div>
            <div className="grid min-w-0 gap-5 xl:col-span-3">
              <SectionShell>
                <WeatherWidget weather={data.weather} errorMessage={sectionErrors.weather ?? null} t={t} />
              </SectionShell>
              <SectionShell>
                <CriticalAlertsWidget items={data.criticalAlerts} t={t} />
              </SectionShell>
            </div>
          </section>
        </FadeIn>

        <FadeIn delayMs={70} distancePx={5}>
          <section className="grid gap-5 xl:grid-cols-12" aria-label="Business performance">
            <div className="min-w-0 xl:col-span-5">
              <SectionShell className="h-full">
                <ScheduleWidget events={data.schedule} errorMessage={sectionErrors.schedule ?? null} t={t} />
              </SectionShell>
            </div>
            <div className="min-w-0 xl:col-span-4">
              <SectionShell className="h-full">
                <div className="border-b border-[var(--color-border-subtle)] px-5 py-4">
                  <p className="text-base font-bold text-[var(--color-text-primary)]">Financial Snapshot</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Live company performance and operating totals.</p>
                </div>
                <CardContent className="p-4">
                  <KPIGrid
                    metrics={data.metrics}
                    localeTag={localeTag}
                    isLoading={isLoading}
                    isEmpty={data.metrics.length === 0}
                    errorMessage={sectionErrors.kpi ?? null}
                    formatValue={(metric) => metric.displayValueKey ? t(metric.displayValueKey) : formatMetricValue(metric, localeTag)}
                    t={t}
                  />
                </CardContent>
              </SectionShell>
            </div>
            <div className="min-w-0 xl:col-span-3">
              <SectionShell className="h-full">
                <ActivityFeed items={data.activities} isLoading={isLoading} errorMessage={sectionErrors.activity ?? null} t={t} />
              </SectionShell>
            </div>
          </section>
        </FadeIn>

        <FadeIn delayMs={105} distancePx={5}>
          <section className="grid gap-5 lg:grid-cols-3" aria-label="Business health">
            <div className="min-w-0 lg:col-span-1">
              <SectionShell className="h-full">
                <BusinessHealthWidget items={data.businessHealth} briefing={data.morningBriefing} t={t} />
              </SectionShell>
            </div>
            <div className="min-w-0 lg:col-span-2">
              <ExecutiveIntelligenceBar
                companyName={companyName}
                workspaceContext={workspaceContext}
                dashboardData={data}
                dashboardSectionErrors={sectionErrors}
                isDashboardLoading={isLoading}
                localeTag={localeTag}
                t={t}
              />
            </div>
          </section>
        </FadeIn>

        <FadeIn delayMs={140} distancePx={5}>
          <Card className="overflow-hidden border-[#163d6b] bg-[linear-gradient(135deg,#06162b_0%,#071d37_55%,#09294a_100%)] text-white shadow-[0_18px_50px_rgba(5,25,55,0.18)]">
            <CardContent className="p-0 [&_*]:border-white/10">
              <AICommandCenter recommendations={data.recommendations} isLoading={isLoading} errorMessage={sectionErrors["command-center"] ?? null} t={t} />
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </MotionProvider>
  );
}
