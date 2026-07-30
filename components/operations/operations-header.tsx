import { Button, Input, Select } from "@/components/ui";
import type { OperationsShift } from "@/lib/operations";
import { CalendarDays, Clock3, Filter, MapPin, RefreshCcw, Search } from "./operations-icons";

type OperationsHeaderProps = {
  title: string;
  dateLabel: string;
  summary: string;
  companyContext: string;
  locationContext: string;
  date: string;
  shift: OperationsShift | "all";
  project: string;
  query: string;
  projectOptions: string[];
  onDateChange: (value: string) => void;
  onShiftChange: (value: OperationsShift | "all") => void;
  onProjectChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function OperationsHeader({
  title,
  dateLabel,
  summary,
  companyContext,
  locationContext,
  date,
  shift,
  project,
  query,
  projectOptions,
  onDateChange,
  onShiftChange,
  onProjectChange,
  onQueryChange,
  onRefresh,
  t,
}: OperationsHeaderProps) {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-700)]">
            {t("operations.header.badge")}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h1>
          <p className="mt-2 text-base font-medium text-[var(--color-text-secondary)]">{summary}</p>

          <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--color-text-secondary)]">
            <p className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-3 py-1.5">
              <CalendarDays className="h-4 w-4" />
              {dateLabel}
            </p>
            <p className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-3 py-1.5">
              <MapPin className="h-4 w-4" />
              {locationContext}
            </p>
            <p className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-3 py-1.5">
              <Filter className="h-4 w-4" />
              {companyContext}
            </p>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[520px]">
          <label className="space-y-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("operations.filters.date")}</span>
            <Input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("operations.filters.shift")}</span>
            <Select value={shift} onChange={(event) => onShiftChange(event.target.value as OperationsShift | "all")}
            >
              <option value="all">{t("operations.filters.allShifts")}</option>
              <option value="day">{t("operations.shift.day")}</option>
              <option value="swing">{t("operations.shift.swing")}</option>
              <option value="night">{t("operations.shift.night")}</option>
            </Select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("operations.filters.project")}</span>
            <Select value={project} onChange={(event) => onProjectChange(event.target.value)}>
              {projectOptions.map((option) => (
                <option key={option} value={option}>{option === "all" ? t("operations.filters.allProjects") : option}</option>
              ))}
            </Select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <span>{t("operations.filters.search")}</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder={t("operations.filters.searchPlaceholder")}
                className="pl-9"
              />
            </div>
          </label>

          <Button type="button" onClick={onRefresh} className="sm:col-span-2">
            <RefreshCcw className="h-4 w-4" />
            {t("operations.actions.refresh")}
          </Button>
          <p className="sm:col-span-2 inline-flex items-center gap-2 text-xs font-medium text-[var(--color-text-secondary)]">
            <Clock3 className="h-3.5 w-3.5" />
            {t("operations.header.updatedHint")}
          </p>
        </div>
      </div>
    </section>
  );
}
