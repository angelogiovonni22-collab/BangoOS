import { FilterToolbar, Input, SearchInput, Select } from "@/components/ui";

type FilterOption = { value: string; label: string };

type ChangeOrdersFiltersProps = {
  searchValue: string;
  statusValue: string;
  customerValue: string;
  projectValue: string;
  dateFrom: string;
  dateTo: string;
  archivedValue: string;
  statusOptions: FilterOption[];
  customerOptions: FilterOption[];
  projectOptions: FilterOption[];
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCustomerChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onArchivedChange: (value: string) => void;
};

export function ChangeOrdersFilters({
  searchValue,
  statusValue,
  customerValue,
  projectValue,
  dateFrom,
  dateTo,
  archivedValue,
  statusOptions,
  customerOptions,
  projectOptions,
  onSearchChange,
  onStatusChange,
  onCustomerChange,
  onProjectChange,
  onDateFromChange,
  onDateToChange,
  onArchivedChange,
}: ChangeOrdersFiltersProps) {
  return (
    <FilterToolbar gridClassName="md:grid-cols-2 xl:grid-cols-7">
      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Search</span>
        <SearchInput
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by number, title, customer, project, or description"
          aria-label="Search change orders"
          className="h-10 py-2"
        />
      </label>

      <FilterSelect label="Status" value={statusValue} onChange={onStatusChange} options={statusOptions} />
      <FilterSelect label="Customer" value={customerValue} onChange={onCustomerChange} options={customerOptions} />
      <FilterSelect label="Project" value={projectValue} onChange={onProjectChange} options={projectOptions} />

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Date From</span>
        <Input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} className="h-10 py-2" />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Date To</span>
        <Input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} className="h-10 py-2" />
      </label>

      <FilterSelect
        label="Records"
        value={archivedValue}
        onChange={onArchivedChange}
        options={[
          { value: "active", label: "Active" },
          { value: "archived", label: "Archived" },
          { value: "all", label: "All" },
        ]}
      />
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
