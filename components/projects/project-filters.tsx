"use client";

import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";

type FilterOption = {
  value: string;
  label: string;
};

type ProjectFiltersProps = {
  searchValue: string;
  statusValue: string;
  managerValue: string;
  customerValue: string;
  typeValue: string;
  statusOptions: FilterOption[];
  managerOptions: FilterOption[];
  customerOptions: FilterOption[];
  typeOptions: FilterOption[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onManagerChange: (value: string) => void;
  onCustomerChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectFilters({
  searchValue,
  statusValue,
  managerValue,
  customerValue,
  typeValue,
  statusOptions,
  managerOptions,
  customerOptions,
  typeOptions,
  onSearchChange,
  onStatusChange,
  onManagerChange,
  onCustomerChange,
  onTypeChange,
  t,
}: ProjectFiltersProps) {
  const { term } = useAdaptiveBos();
  const customerLabel = term("customer", "Customer");

  return (
    <FilterToolbar gridClassName="md:grid-cols-2 xl:grid-cols-6">
      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)] md:col-span-2 xl:col-span-2">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("projects.filterSearch")}</span>
        <SearchInput
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t("navigation.searchProjectRecordsPlaceholder")}
          aria-label={t("navigation.searchProjectRecords")}
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("projects.filterStatus")}</span>
        <Select
          value={statusValue}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label={t("projects.filterStatus")}
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("projects.filterProjectManager")}</span>
        <Select
          value={managerValue}
          onChange={(event) => onManagerChange(event.target.value)}
          aria-label={t("projects.filterProjectManager")}
        >
          {managerOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{customerLabel}</span>
        <Select
          value={customerValue}
          onChange={(event) => onCustomerChange(event.target.value)}
          aria-label={customerLabel}
        >
          {customerOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("projects.filterProjectType")}</span>
        <Select
          value={typeValue}
          onChange={(event) => onTypeChange(event.target.value)}
          aria-label={t("projects.filterProjectType")}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
      </label>
    </FilterToolbar>
  );
}
