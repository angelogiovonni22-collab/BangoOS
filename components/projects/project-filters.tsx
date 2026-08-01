import { FilterToolbar, SearchInput, Select } from "@/components/ui";

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
  return (
    <FilterToolbar gridClassName="md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("projects.filterSearch")}</span>
          <SearchInput
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("projects.searchPlaceholder")}
            aria-label={t("projects.filterSearch")}
            className="h-10 py-2"
          />
        </label>

        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("projects.filterStatus")}</span>
          <Select
            value={statusValue}
            onChange={(event) => onStatusChange(event.target.value)}
            aria-label={t("projects.filterStatus")}
            className="h-10 py-2"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Superintendent</span>
          <Select
            value={managerValue}
            onChange={(event) => onManagerChange(event.target.value)}
            aria-label="Superintendent"
            className="h-10 py-2"
          >
            {managerOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>

        <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
          <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">{t("projects.filterCustomerLabel")}</span>
          <Select
            value={customerValue}
            onChange={(event) => onCustomerChange(event.target.value)}
            aria-label={t("projects.filterCustomerLabel")}
            className="h-10 py-2"
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
            className="h-10 py-2"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </label>
    </FilterToolbar>
  );
}
