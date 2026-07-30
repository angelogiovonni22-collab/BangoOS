"use client";

import Link from "next/link";
import {
  ReportDashboardMetrics,
  ReportEmptyState,
  ReportHistoryTable,
  ReportLoadingState,
} from "@/components/daily-reports";
import { ErrorState, Input, Select } from "@/components/ui";
import { useDailyReports } from "@/lib/daily-reports";
import { useI18n } from "@/lib/i18n/provider";

export default function DailyReportsPage() {
  const { t } = useI18n();
  const {
    items,
    metrics,
    analytics,
    projectOptions,
    superintendentOptions,
    filters,
    total,
    totalPages,
    canPrev,
    canNext,
    isLoading,
    errorMessage,
    setFilter,
    setQuery,
    setSortBy,
    setStatus,
  } = useDailyReports();

  if (isLoading) {
    return <ReportLoadingState />;
  }

  if (errorMessage) {
    return <ErrorState title={t("dailyReports.error.title")} description={t(errorMessage)} />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-700)]">{t("dailyReports.dashboard.badge")}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("dailyReports.dashboard.title")}</h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("dailyReports.dashboard.description")}</p>
          </div>

          <Link href="/daily-reports/new" className="inline-flex h-11 items-center rounded-[var(--radius-lg)] bg-[var(--color-brand-600)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-sm)]">
            + {t("dailyReports.actions.quickCreate")}
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
            <span>{t("dailyReports.filters.search")}</span>
            <Input
              value={filters.query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("dailyReports.filters.searchPlaceholder")}
            />
          </label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("dailyReports.filters.date")}</span>
            <Input type="date" value={filters.date} onChange={(event) => setFilter("date", event.target.value)} />
          </label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("dailyReports.filters.project")}</span>
            <Select value={filters.projectId} onChange={(event) => setFilter("projectId", event.target.value)}>
              <option value="all">{t("dailyReports.filters.allProjects")}</option>
              {projectOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("dailyReports.filters.superintendent")}</span>
            <Select value={filters.superintendentId} onChange={(event) => setFilter("superintendentId", event.target.value)}>
              <option value="all">{t("dailyReports.filters.allSuperintendents")}</option>
              {superintendentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </Select>
          </label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("dailyReports.filters.status")}</span>
            <Select value={filters.status} onChange={(event) => setStatus(event.target.value as typeof filters.status)}>
              <option value="all">{t("dailyReports.filters.allStatuses")}</option>
              <option value="draft">{t("dailyReports.status.draft")}</option>
              <option value="submitted">{t("dailyReports.status.submitted")}</option>
              <option value="reviewed">{t("dailyReports.status.reviewed")}</option>
              <option value="approved">{t("dailyReports.status.approved")}</option>
            </Select>
          </label>
        </div>
      </section>

      <ReportDashboardMetrics metrics={metrics} t={t} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AnalyticsCard label={t("dailyReports.analytics.laborHours")} value={analytics.laborHours.toFixed(1)} />
        <AnalyticsCard label={t("dailyReports.analytics.production")} value={analytics.productionUnits.toFixed(1)} />
        <AnalyticsCard label={t("dailyReports.analytics.delayTrends")} value={String(analytics.delayEvents)} />
        <AnalyticsCard label={t("dailyReports.analytics.incidentCounts")} value={String(analytics.incidentCount)} />
        <AnalyticsCard label={t("dailyReports.analytics.completionRate")} value={`${analytics.completionRate}%`} />
        <AnalyticsCard label={t("dailyReports.analytics.averageSubmissionTime")} value={`${analytics.averageSubmissionHours.toFixed(1)}h`} />
      </section>

      {items.length === 0 ? (
        <ReportEmptyState
          title={t("dailyReports.empty.title")}
          description={t("dailyReports.empty.description")}
          actionLabel={t("dailyReports.actions.quickCreate")}
        />
      ) : (
        <ReportHistoryTable
          items={items}
          sortBy={filters.sortBy}
          page={filters.page}
          totalPages={totalPages}
          total={total}
          canPrev={canPrev}
          canNext={canNext}
          onSortChange={setSortBy}
          onPageChange={(page) => setFilter("page", page)}
          onStatusChange={setStatus}
          currentStatus={filters.status}
          t={t}
        />
      )}
    </div>
  );
}

function AnalyticsCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
    </article>
  );
}
