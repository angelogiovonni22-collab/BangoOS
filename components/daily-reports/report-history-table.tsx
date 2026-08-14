import Link from "next/link";
import { Button, Select } from "@/components/ui";
import type { DailyReport, DailyReportSortKey, DailyReportStatus } from "@/lib/daily-reports";
import { ReportStatusChip } from "./report-status-chip";

type ReportHistoryTableProps = {
  items: DailyReport[];
  sortBy: DailyReportSortKey;
  page: number;
  totalPages: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onSortChange: (value: DailyReportSortKey) => void;
  onPageChange: (value: number) => void;
  onStatusChange: (value: DailyReportStatus | "all") => void;
  currentStatus: DailyReportStatus | "all";
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ReportHistoryTable({
  items,
  sortBy,
  page,
  totalPages,
  total,
  canPrev,
  canNext,
  onSortChange,
  onPageChange,
  onStatusChange,
  currentStatus,
  t,
}: ReportHistoryTableProps) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 border-b border-[var(--color-border-subtle)] px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.history.title")}</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.history.description")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]" htmlFor="report-status-filter">
            {t("dailyReports.filters.status")}
          </label>
          <Select
            id="report-status-filter"
            value={currentStatus}
            onChange={(event) => onStatusChange(event.target.value as DailyReportStatus | "all")}
            className="h-10 w-40 py-2"
          >
            <option value="all">{t("dailyReports.filters.allStatuses")}</option>
            <option value="draft">{t("dailyReports.status.draft")}</option>
            <option value="submitted">{t("dailyReports.status.submitted")}</option>
            <option value="reviewed">{t("dailyReports.status.reviewed")}</option>
            <option value="approved">{t("dailyReports.status.approved")}</option>
          </Select>

          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]" htmlFor="report-sort-by">
            {t("dailyReports.history.sortBy")}
          </label>
          <Select
            id="report-sort-by"
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as DailyReportSortKey)}
            className="h-10 w-48 py-2"
          >
            <option value="date_desc">{t("dailyReports.history.sort.dateDesc")}</option>
            <option value="date_asc">{t("dailyReports.history.sort.dateAsc")}</option>
            <option value="project_asc">{t("dailyReports.history.sort.project")}</option>
            <option value="status">{t("dailyReports.history.sort.status")}</option>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border-subtle)]">
          <thead className="bg-[var(--color-surface-subtle)]">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("dailyReports.history.columns.report")}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("dailyReports.history.columns.project")}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("dailyReports.history.columns.date")}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("dailyReports.history.columns.superintendent")}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("dailyReports.history.columns.status")}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("dailyReports.history.columns.laborHours")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-subtle)] bg-white">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">
                  <Link href={`/daily-reports/${item.id}`} className="font-semibold text-[var(--color-brand-700)] hover:underline">
                    {item.reportNumber}
                  </Link>
                </td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">
                  <Link href={`/projects/${item.header.projectId}`} className="hover:underline">
                    {item.header.projectName}
                  </Link>
                </td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">{item.header.date}</td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">{item.header.superintendentName}</td>
                <td className="px-5 py-3 text-sm"><ReportStatusChip status={item.header.overallStatus} t={t} /></td>
                <td className="px-5 py-3 text-sm text-[var(--color-text-primary)]">{item.laborTotals.totalLaborHours.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("dailyReports.history.pagination", { page, totalPages, total })}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={!canPrev}>
            {t("dailyReports.actions.previous")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={!canNext}>
            {t("dailyReports.actions.next")}
          </Button>
        </div>
      </div>
    </section>
  );
}
