import { Select } from "@/components/ui";
import type {
  ProjectEventCategory,
  ProjectEventImpactArea,
  ProjectEventPriority,
  ProjectTimelineDateRange,
} from "@/lib/project-intelligence/types";

type ProjectTimelineFiltersProps = {
  category: ProjectEventCategory | "all";
  priority: ProjectEventPriority | "all";
  impact: ProjectEventImpactArea | "all";
  dateRange: ProjectTimelineDateRange;
  activeFilterCount: number;
  onCategoryChange: (value: ProjectEventCategory | "all") => void;
  onPriorityChange: (value: ProjectEventPriority | "all") => void;
  onImpactChange: (value: ProjectEventImpactArea | "all") => void;
  onDateRangeChange: (value: ProjectTimelineDateRange) => void;
  onClear: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const categoryOptions: Array<{ value: ProjectEventCategory; labelKey: string }> = [
  { value: "project", labelKey: "projects.intelligenceCategoryProject" },
  { value: "customer", labelKey: "projects.intelligenceCategoryCustomer" },
  { value: "estimate", labelKey: "projects.intelligenceCategoryEstimate" },
  { value: "contract", labelKey: "projects.intelligenceCategoryContract" },
  { value: "permit", labelKey: "projects.intelligenceCategoryPermit" },
  { value: "schedule", labelKey: "projects.intelligenceCategorySchedule" },
  { value: "task", labelKey: "projects.intelligenceCategoryTask" },
  { value: "employee", labelKey: "projects.intelligenceCategoryEmployee" },
  { value: "daily_report", labelKey: "projects.intelligenceCategoryDailyReport" },
  { value: "inspection", labelKey: "projects.intelligenceCategoryInspection" },
  { value: "safety", labelKey: "projects.intelligenceCategorySafety" },
  { value: "material", labelKey: "projects.intelligenceCategoryMaterial" },
  { value: "equipment", labelKey: "projects.intelligenceCategoryEquipment" },
  { value: "sitecam", labelKey: "projects.intelligenceCategorySiteCam" },
  { value: "document", labelKey: "projects.intelligenceCategoryDocument" },
  { value: "change_order", labelKey: "projects.intelligenceCategoryChangeOrder" },
  { value: "invoice", labelKey: "projects.intelligenceCategoryInvoice" },
  { value: "payment", labelKey: "projects.intelligenceCategoryPayment" },
  { value: "budget", labelKey: "projects.intelligenceCategoryBudget" },
  { value: "ai", labelKey: "projects.intelligenceCategoryAI" },
];

const priorityOptions: Array<{ value: ProjectEventPriority; labelKey: string }> = [
  { value: "low", labelKey: "projects.intelligencePriorityLow" },
  { value: "normal", labelKey: "projects.intelligencePriorityNormal" },
  { value: "high", labelKey: "projects.intelligencePriorityHigh" },
  { value: "critical", labelKey: "projects.intelligencePriorityCritical" },
];

const impactOptions: Array<{ value: ProjectEventImpactArea; labelKey: string }> = [
  { value: "financial", labelKey: "projects.intelligenceImpactFinancial" },
  { value: "schedule", labelKey: "projects.intelligenceImpactSchedule" },
  { value: "safety", labelKey: "projects.intelligenceImpactSafety" },
  { value: "customer", labelKey: "projects.intelligenceImpactCustomer" },
  { value: "documentation", labelKey: "projects.intelligenceImpactDocumentation" },
  { value: "none", labelKey: "projects.intelligenceImpactNone" },
];

const dateRangeOptions: Array<{ value: ProjectTimelineDateRange; labelKey: string }> = [
  { value: "today", labelKey: "projects.intelligenceDateRangeToday" },
  { value: "last_7_days", labelKey: "projects.intelligenceDateRangeLast7" },
  { value: "last_30_days", labelKey: "projects.intelligenceDateRangeLast30" },
  { value: "custom", labelKey: "projects.intelligenceDateRangeCustom" },
  { value: "all_time", labelKey: "projects.intelligenceDateRangeAll" },
];

export function ProjectTimelineFilters({
  category,
  priority,
  impact,
  dateRange,
  activeFilterCount,
  onCategoryChange,
  onPriorityChange,
  onImpactChange,
  onDateRangeChange,
  onClear,
  t,
}: ProjectTimelineFiltersProps) {
  return (
    <div className="space-y-3 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t("projects.intelligenceFilters")}</p>
        <button
          type="button"
          onClick={onClear}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
        >
          {t("projects.intelligenceClearFilters")}
        </button>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]" aria-live="polite">
        {t("projects.intelligenceActiveFilters", { count: activeFilterCount })}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceFilterCategory")}</span>
          <Select value={category} onChange={(event) => onCategoryChange(event.target.value as ProjectEventCategory | "all") }>
            <option value="all">{t("projects.intelligenceFilterAll")}</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceFilterPriority")}</span>
          <Select value={priority} onChange={(event) => onPriorityChange(event.target.value as ProjectEventPriority | "all") }>
            <option value="all">{t("projects.intelligenceFilterAll")}</option>
            {priorityOptions.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceFilterImpact")}</span>
          <Select value={impact} onChange={(event) => onImpactChange(event.target.value as ProjectEventImpactArea | "all") }>
            <option value="all">{t("projects.intelligenceFilterAll")}</option>
            {impactOptions.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceFilterDateRange")}</span>
          <Select value={dateRange} onChange={(event) => onDateRangeChange(event.target.value as ProjectTimelineDateRange)}>
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
            ))}
          </Select>
        </label>
      </div>
    </div>
  );
}
