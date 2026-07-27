"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  SearchInput,
} from "@/components/ui";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";

type KpiMetric = {
  key: string;
  titleKey: string;
  value: string;
  subtitleKey: string;
  icon: string;
  trendLabelKey: string;
  trendDirection: "up" | "down";
};

type ScheduleItem = {
  id: string;
  time: string;
  customer: string;
  project: string;
  crew: string;
  status: "on_time" | "in_progress" | "pending" | "at_risk";
};

type ActivityItem = {
  id: string;
  eventKey: string;
  details: string;
  timestamp: string;
};

const kpiMetrics: KpiMetric[] = [
  {
    key: "revenueThisMonth",
    titleKey: "revenueThisMonth",
    value: "$248,900",
    subtitleKey: "revenueThisMonthSubtitle",
    icon: "$",
    trendLabelKey: "revenueThisMonthTrend",
    trendDirection: "up",
  },
  {
    key: "activeProjects",
    titleKey: "activeProjects",
    value: "14",
    subtitleKey: "activeProjectsSubtitle",
    icon: "P",
    trendLabelKey: "activeProjectsTrend",
    trendDirection: "up",
  },
  {
    key: "pendingEstimates",
    titleKey: "pendingEstimates",
    value: "9",
    subtitleKey: "pendingEstimatesSubtitle",
    icon: "E",
    trendLabelKey: "pendingEstimatesTrend",
    trendDirection: "down",
  },
  {
    key: "outstandingInvoices",
    titleKey: "outstandingInvoices",
    value: "$71,300",
    subtitleKey: "outstandingInvoicesSubtitle",
    icon: "I",
    trendLabelKey: "outstandingInvoicesTrend",
    trendDirection: "up",
  },
  {
    key: "employeesWorkingToday",
    titleKey: "employeesWorkingToday",
    value: "26",
    subtitleKey: "employeesWorkingTodaySubtitle",
    icon: "T",
    trendLabelKey: "employeesWorkingTodayTrend",
    trendDirection: "up",
  },
  {
    key: "jobsScheduledThisWeek",
    titleKey: "jobsScheduledThisWeek",
    value: "22",
    subtitleKey: "jobsScheduledThisWeekSubtitle",
    icon: "C",
    trendLabelKey: "jobsScheduledThisWeekTrend",
    trendDirection: "up",
  },
];

const todaySchedule: ScheduleItem[] = [
  {
    id: "s-1",
    time: "7:30 AM",
    customer: "Riverside Apartments",
    project: "Roofing Phase 2",
    crew: "Crew A",
    status: "on_time",
  },
  {
    id: "s-2",
    time: "9:00 AM",
    customer: "Northpoint Medical",
    project: "Lobby Renovation",
    crew: "Crew C",
    status: "in_progress",
  },
  {
    id: "s-3",
    time: "11:15 AM",
    customer: "Harper Residence",
    project: "Foundation Inspection",
    crew: "Crew B",
    status: "pending",
  },
  {
    id: "s-4",
    time: "1:45 PM",
    customer: "Summit Logistics",
    project: "Dock Expansion",
    crew: "Crew D",
    status: "at_risk",
  },
  {
    id: "s-5",
    time: "3:30 PM",
    customer: "Westfield Church",
    project: "Electrical Upgrade",
    crew: "Crew E",
    status: "on_time",
  },
];

const recentActivity: ActivityItem[] = [
  {
    id: "a-1",
    eventKey: "estimateCreated",
    details: "estimateCreatedDetails",
    timestamp: "time12MinutesAgo",
  },
  {
    id: "a-2",
    eventKey: "invoicePaid",
    details: "invoicePaidDetails",
    timestamp: "time48MinutesAgo",
  },
  {
    id: "a-3",
    eventKey: "customerAdded",
    details: "customerAddedDetails",
    timestamp: "time1HourAgo",
  },
  {
    id: "a-4",
    eventKey: "projectCompleted",
    details: "projectCompletedDetails",
    timestamp: "time2HoursAgo",
  },
  {
    id: "a-5",
    eventKey: "employeeAssigned",
    details: "employeeAssignedDetails",
    timestamp: "time3HoursAgo",
  },
];

const aiInsightKeys = ["insightOne", "insightTwo", "insightThree", "insightFour"];

const quickActions = [
  { key: "newEstimate", icon: "E" },
  { key: "newCustomer", icon: "C" },
  { key: "newProject", icon: "P" },
  { key: "createInvoice", icon: "I" },
  { key: "scheduleJob", icon: "S" },
];

export default function DashboardPage() {
  const { locale, t } = useI18n();

  const currentDate = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <Card as="section" className="overflow-hidden">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-700)]">
                {t("dashboard.executiveDashboard")}
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
                {t("common.welcomeBack")}, Angelo
              </h1>

              <p className="mt-2 text-sm text-[var(--color-text-secondary)] sm:text-base">
                {t("dashboard.executiveSummary")}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[360px]">
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--color-text-muted)]">
                <span>{currentDate}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={t("common.notifications")}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
                  >
                    Bell
                  </button>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] text-sm font-semibold text-white shadow-[var(--shadow-sm)]">
                    AG
                  </div>
                </div>
              </div>

              <SearchInput placeholder={t("common.searchWorkspacePlaceholder")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-6">
        {kpiMetrics.map((metric) => (
          <KpiCard key={metric.key} metric={metric} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card as="section" className="overflow-hidden">
          <CardHeader>
            <CardTitle>{t("dashboard.todaySchedule")}</CardTitle>
            <CardDescription>
              {t("dashboard.todayScheduleDescription")}
            </CardDescription>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--color-border-subtle)]">
              <thead className="bg-[var(--color-surface-subtle)]">
                <tr>
                  <ScheduleHeading>{t("dashboard.tableTime")}</ScheduleHeading>
                  <ScheduleHeading>{t("dashboard.tableCustomer")}</ScheduleHeading>
                  <ScheduleHeading>{t("dashboard.tableProject")}</ScheduleHeading>
                  <ScheduleHeading>{t("dashboard.tableCrew")}</ScheduleHeading>
                  <ScheduleHeading>{t("dashboard.tableStatus")}</ScheduleHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--color-border-subtle)] bg-white">
                {todaySchedule.map((item) => (
                  <tr key={item.id} className="transition hover:bg-[var(--color-surface-subtle)]">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-[var(--color-text-primary)]">
                      {item.time}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                      {item.customer}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                      {item.project}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                      {item.crew}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <ScheduleStatus status={item.status} label={t(`dashboard.${mapStatusKey(item.status)}`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card as="section">
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
            <CardDescription>
              {t("dashboard.recentActivityDescription")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 p-6">
            {recentActivity.map((item) => (
              <article
                key={item.id}
                className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(`dashboard.${item.eventKey}`)}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t(`dashboard.${item.details}`)}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs font-medium text-[var(--color-text-muted)]">
                    {t(`dashboard.${item.timestamp}`)}
                  </span>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card as="section">
          <CardHeader>
            <CardTitle>{t("dashboard.quickActions")}</CardTitle>
            <CardDescription>
              {t("dashboard.quickActionsDescription")}
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <Button
                key={action.key}
                type="button"
                variant="secondary"
                size="lg"
                className="justify-start gap-3 text-left hover:-translate-y-0.5"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-xs font-semibold text-[var(--color-brand-700)]">
                  {action.icon}
                </span>
                <span>{t(`dashboard.${action.key}`)}</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card as="section" className="bg-[var(--gradient-ai)] text-[var(--color-text-inverse)]">
          <CardHeader className="border-white/10">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-100)]">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-bold">
                AI
              </span>
              <span>{t("dashboard.aiInsights")}</span>
            </div>
            <CardDescription className="mt-3 text-[var(--color-brand-100)]">
              {t("dashboard.aiInsightsDescription")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 p-6">
            {aiInsightKeys.map((insightKey) => (
              <div
                key={insightKey}
                className="rounded-[var(--radius-xl)] border border-white/20 bg-white/10 p-3 text-sm leading-6 text-[var(--color-text-inverse)]"
              >
                {t(`dashboard.${insightKey}`)}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({ metric }: { metric: KpiMetric }) {
  const { t } = useI18n();

  return (
    <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]">
      <CardContent className="flex h-full min-h-[172px] flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] text-sm font-bold text-[var(--color-brand-700)]">
            {metric.icon}
          </span>
          <TrendBadge direction={metric.trendDirection} label={t(`dashboard.${metric.trendLabelKey}`)} />
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-[var(--color-text-muted)]">{t(`dashboard.${metric.titleKey}`)}</p>
          <p className="mt-3 text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {metric.value}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t(`dashboard.${metric.subtitleKey}`)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendBadge({ direction, label }: { direction: "up" | "down"; label: string }) {
  const toneClass =
    direction === "up"
      ? "bg-[var(--color-success-50)] text-[var(--color-success-700)] ring-[var(--color-success-500)]/20"
      : "bg-[var(--color-warning-50)] text-[var(--color-warning-700)] ring-[var(--color-warning-500)]/20";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${toneClass}`}
    >
      {label}
    </span>
  );
}

function ScheduleHeading({ children }: { children: ReactNode }) {
  return (
    <th
      scope="col"
      className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]"
    >
      {children}
    </th>
  );
}

function ScheduleStatus({
  status,
  label,
}: {
  status: ScheduleItem["status"];
  label: string;
}) {
  if (status === "on_time") {
    return <Badge tone="success">{label}</Badge>;
  }

  if (status === "in_progress") {
    return <Badge tone="info">{label}</Badge>;
  }

  if (status === "pending") {
    return <Badge tone="warning">{label}</Badge>;
  }

  return <Badge tone="danger">{label}</Badge>;
}

function mapStatusKey(status: ScheduleItem["status"]) {
  if (status === "on_time") {
    return "statusOnTime";
  }

  if (status === "in_progress") {
    return "statusInProgress";
  }

  if (status === "pending") {
    return "statusPending";
  }

  return "statusAtRisk";
}