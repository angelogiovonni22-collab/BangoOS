"use client";

import { Button, Input, Select } from "@/components/ui";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";
import type { ScheduleFilterState, ScheduleView } from "@/lib/scheduling";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarClock,
  ClipboardList,
  RefreshCcw,
  Search,
  Users,
} from "./scheduling-icons";

type SchedulingHeaderProps = {
  title: string;
  dateRangeLabel: string;
  summary: string;
  companyContext: string;
  branchContext: string;
  periodDate: string;
  view: ScheduleView;
  filters: ScheduleFilterState;
  projectOptions: Array<{ id: string; name: string }>;
  crewOptions: Array<{ id: string; name: string }>;
  tradeOptions: string[];
  onViewChange: (value: ScheduleView) => void;
  onPeriodDateChange: (value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onRefresh: () => void;
  onCreateAssignment: () => void;
  onOpenDispatch: () => void;
  onFilterChange: <K extends keyof ScheduleFilterState>(key: K, value: ScheduleFilterState[K]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function SchedulingHeader({
  title,
  dateRangeLabel,
  summary,
  companyContext,
  branchContext,
  periodDate,
  view,
  filters,
  projectOptions,
  crewOptions,
  tradeOptions,
  onViewChange,
  onPeriodDateChange,
  onPrev,
  onNext,
  onToday,
  onRefresh,
  onCreateAssignment,
  onOpenDispatch,
  onFilterChange,
  t,
}: SchedulingHeaderProps) {
  const { term } = useAdaptiveBos();
  const projectLabel = term("project", "Project");
  const workforceLabel = term("workforce", "Workforce");

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h1>
            <p className="mt-2 text-base font-medium text-[var(--color-text-secondary)]">{summary}</p>

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-[var(--color-text-secondary)]">
              <p className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-3 py-1.5">
                <Calendar className="h-4 w-4" />
                {dateRangeLabel}
              </p>
              <p className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-3 py-1.5">
                <Users className="h-4 w-4" />
                {companyContext}
              </p>
              <p className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-3 py-1.5">
                <CalendarClock className="h-4 w-4" />
                {branchContext}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrev}><ArrowLeft className="h-4 w-4" />{t("scheduling.actions.previous")}</Button>
            <Button variant="outline" size="sm" onClick={onToday}>{t("scheduling.actions.today")}</Button>
            <Button variant="outline" size="sm" onClick={onNext}>{t("scheduling.actions.next")}<ArrowRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCcw className="h-4 w-4" />{t("scheduling.actions.refresh")}</Button>
            <Button variant="secondary" size="sm" onClick={onOpenDispatch}><ClipboardList className="h-4 w-4" />{t("scheduling.actions.openDispatch")}</Button>
            <Button size="sm" onClick={onCreateAssignment}>{t("scheduling.actions.createAssignment")}</Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]"><span>{t("scheduling.filters.date")}</span><Input type="date" value={periodDate} onChange={(event) => onPeriodDateChange(event.target.value)} /></label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]"><span>{t("scheduling.filters.view")}</span><Select value={view} onChange={(event) => onViewChange(event.target.value as ScheduleView)}><option value="day">{t("scheduling.views.day")}</option><option value="week">{t("scheduling.views.week")}</option><option value="month">{t("scheduling.views.month")}</option></Select></label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{projectLabel}</span>
            <Select value={filters.project} onChange={(event) => onFilterChange("project", event.target.value)}><option value="all">{t("scheduling.filters.allProjects")}</option>{projectOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</Select>
          </label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{workforceLabel}</span>
            <Select value={filters.crew} onChange={(event) => onFilterChange("crew", event.target.value)}><option value="all">{t("scheduling.filters.allCrews")}</option>{crewOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</Select>
          </label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]"><span>{t("scheduling.filters.trade")}</span><Select value={filters.employeeTrade} onChange={(event) => onFilterChange("employeeTrade", event.target.value)}><option value="all">{t("scheduling.filters.allTrades")}</option>{tradeOptions.map((option) => <option key={option} value={option}>{option}</option>)}</Select></label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]"><span>{t("scheduling.filters.shift")}</span><Select value={filters.shift} onChange={(event) => onFilterChange("shift", event.target.value as ScheduleFilterState["shift"])}><option value="all">{t("scheduling.filters.allShifts")}</option><option value="day">{t("scheduling.shift.day")}</option><option value="swing">{t("scheduling.shift.swing")}</option><option value="night">{t("scheduling.shift.night")}</option></Select></label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]"><span>{t("scheduling.filters.status")}</span><Select value={filters.status} onChange={(event) => onFilterChange("status", event.target.value as ScheduleFilterState["status"])}><option value="all">{t("scheduling.filters.allStatuses")}</option><option value="draft">{t("scheduling.assignmentStatus.draft")}</option><option value="published">{t("scheduling.assignmentStatus.published")}</option><option value="in_progress">{t("scheduling.assignmentStatus.in_progress")}</option><option value="completed">{t("scheduling.assignmentStatus.completed")}</option><option value="cancelled">{t("scheduling.assignmentStatus.cancelled")}</option></Select></label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2"><span>{t("scheduling.filters.search")}</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" /><Input value={filters.query} onChange={(event) => onFilterChange("query", event.target.value)} className="pl-9" placeholder={t("scheduling.filters.searchPlaceholder")} /></div></label>

          <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("scheduling.filters.groupBy")}</span>
            <Select value={filters.groupBy} onChange={(event) => onFilterChange("groupBy", event.target.value as ScheduleFilterState["groupBy"])}><option value="project">{projectLabel}</option><option value="crew">{t("scheduling.group.crew")}</option><option value="employee">{t("scheduling.group.employee")}</option><option value="trade">{t("scheduling.group.trade")}</option><option value="location">{t("scheduling.group.location")}</option></Select>
          </label>
        </div>
      </div>
    </section>
  );
}
