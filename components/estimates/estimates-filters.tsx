"use client";

import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";

type FilterOption = { value: string; label: string };

type EstimatesFiltersProps = {
  searchValue: string;
  statusValue: string;
  customerValue: string;
  projectValue: string;
  datePresetValue: string;
  statusOptions: FilterOption[];
  customerOptions: FilterOption[];
  projectOptions: FilterOption[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCustomerChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onDatePresetChange: (value: string) => void;
};

export function EstimatesFilters({
  searchValue,
  statusValue,
  customerValue,
  projectValue,
  datePresetValue,
  statusOptions,
  customerOptions,
  projectOptions,
  onSearchChange,
  onStatusChange,
  onCustomerChange,
  onProjectChange,
  onDatePresetChange,
}: EstimatesFiltersProps) {
  const { term } = useAdaptiveBos();
  const estimateLabel = term("estimate", "Estimate");
  const estimatesLabel = term("estimates", "Estimates");
  const customerLabel = term("customer", "Customer");
  const projectLabel = term("project", "Project");

  return (
    <FilterToolbar gridClassName="md:grid-cols-2 xl:grid-cols-6">
      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Search</span>
        <SearchInput
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={`Search by number, ${estimateLabel.toLowerCase()}, ${customerLabel.toLowerCase()}, or ${projectLabel.toLowerCase()}`}
          aria-label={`Search ${estimatesLabel.toLowerCase()}`}
          className="h-10 py-2"
        />
      </label>

      <FilterSelect label="Status" value={statusValue} onChange={onStatusChange} options={statusOptions} />
      <FilterSelect label={customerLabel} value={customerValue} onChange={onCustomerChange} options={customerOptions} />
      <FilterSelect label={projectLabel} value={projectValue} onChange={onProjectChange} options={projectOptions} />

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Date</span>
        <Select value={datePresetValue} onChange={(event) => onDatePresetChange(event.target.value)} aria-label="Filter by date" className="h-10 py-2">
          <option value="all">All Dates</option>
          <option value="this_month">This Month</option>
          <option value="last_30">Last 30 Days</option>
          <option value="expiring_soon">Expiring in 14 Days</option>
          <option value="expired">Expired</option>
        </Select>
      </label>
    </FilterToolbar>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
      <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label={`Filter by ${label.toLowerCase()}`} className="h-10 py-2">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}