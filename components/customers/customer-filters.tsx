import { FilterToolbar, SearchInput, Select } from "@/components/ui";

type FilterOption = {
  value: string;
  label: string;
};

type CustomerFiltersProps = {
  searchValue: string;
  typeValue: string;
  statusValue: string;
  assignedValue: string;
  typeOptions: FilterOption[];
  statusOptions: FilterOption[];
  assignedOptions: FilterOption[];
  onSearchChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onAssignedChange: (value: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CustomerFilters({
  searchValue,
  typeValue,
  statusValue,
  assignedValue,
  typeOptions,
  statusOptions,
  assignedOptions,
  onSearchChange,
  onTypeChange,
  onStatusChange,
  onAssignedChange,
  t,
}: CustomerFiltersProps) {
  return (
    <FilterToolbar gridClassName="md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("customers.filters.search")}</span>
          <SearchInput
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("customers.filters.searchPlaceholder")}
            aria-label={t("customers.filters.search")}
            className="h-10 py-2"
          />
        </label>

        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("customers.filters.customerType")}</span>
          <Select
            value={typeValue}
            onChange={(event) => onTypeChange(event.target.value)}
            aria-label={t("customers.filters.customerType")}
            className="h-10 py-2"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("customers.filters.status")}</span>
          <Select
            value={statusValue}
            onChange={(event) => onStatusChange(event.target.value)}
            aria-label={t("customers.filters.status")}
            className="h-10 py-2"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("customers.filters.assignedTo")}</span>
          <Select
            value={assignedValue}
            onChange={(event) => onAssignedChange(event.target.value)}
            aria-label={t("customers.filters.assignedTo")}
            className="h-10 py-2"
          >
            {assignedOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>
    </FilterToolbar>
  );
}
