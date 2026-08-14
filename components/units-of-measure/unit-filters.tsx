import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import {
  UNIT_CATEGORIES,
  UNIT_MEASUREMENT_SYSTEMS,
  UNIT_TYPES,
  type UnitCategory,
  type UnitMeasurementSystem,
  type UnitSortKey,
  type UnitType,
} from "@/lib/units-of-measure";

type UnitFiltersProps = {
  query: string;
  category: UnitCategory | "all";
  measurementSystem: UnitMeasurementSystem | "all";
  unitType: UnitType | "all";
  source: "all" | "system" | "company";
  active: "all" | "active" | "inactive";
  fractional: "all" | "fractional" | "whole_only";
  hasConversion: "all" | "with_conversion" | "without_conversion";
  baseUnitId: string;
  sortBy: UnitSortKey;
  baseUnitOptions: Array<{ id: string; code: string; name: string }>;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: UnitCategory | "all") => void;
  onMeasurementSystemChange: (value: UnitMeasurementSystem | "all") => void;
  onUnitTypeChange: (value: UnitType | "all") => void;
  onSourceChange: (value: "all" | "system" | "company") => void;
  onActiveChange: (value: "all" | "active" | "inactive") => void;
  onFractionalChange: (value: "all" | "fractional" | "whole_only") => void;
  onHasConversionChange: (value: "all" | "with_conversion" | "without_conversion") => void;
  onBaseUnitIdChange: (value: string) => void;
  onSortByChange: (value: UnitSortKey) => void;
  activeFilters: number;
};

export function UnitFilters({
  query,
  category,
  measurementSystem,
  unitType,
  source,
  active,
  fractional,
  hasConversion,
  baseUnitId,
  sortBy,
  baseUnitOptions,
  onQueryChange,
  onCategoryChange,
  onMeasurementSystemChange,
  onUnitTypeChange,
  onSourceChange,
  onActiveChange,
  onFractionalChange,
  onHasConversionChange,
  onBaseUnitIdChange,
  onSortByChange,
  activeFilters,
}: UnitFiltersProps) {
  return (
    <FilterToolbar
      gridClassName="md:grid-cols-2 xl:grid-cols-5"
      footer={<p className="text-xs font-medium text-[var(--color-text-secondary)]">Active filters: {activeFilters}</p>}
    >
      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Search</span>
        <SearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search code, name, symbol, plural, or description"
          aria-label="Search units"
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Category</span>
        <Select value={category} onChange={(event) => onCategoryChange(event.target.value as UnitCategory | "all")} className="h-10 py-2">
          <option value="all">All categories</option>
          {UNIT_CATEGORIES.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Measurement System</span>
        <Select value={measurementSystem} onChange={(event) => onMeasurementSystemChange(event.target.value as UnitMeasurementSystem | "all")} className="h-10 py-2">
          <option value="all">All systems</option>
          {UNIT_MEASUREMENT_SYSTEMS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Unit Type</span>
        <Select value={unitType} onChange={(event) => onUnitTypeChange(event.target.value as UnitType | "all")} className="h-10 py-2">
          <option value="all">All types</option>
          {UNIT_TYPES.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Source</span>
        <Select value={source} onChange={(event) => onSourceChange(event.target.value as "all" | "system" | "company")} className="h-10 py-2">
          <option value="all">All sources</option>
          <option value="system">System</option>
          <option value="company">Company</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Status</span>
        <Select value={active} onChange={(event) => onActiveChange(event.target.value as "all" | "active" | "inactive")} className="h-10 py-2">
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Fractional</span>
        <Select value={fractional} onChange={(event) => onFractionalChange(event.target.value as "all" | "fractional" | "whole_only")} className="h-10 py-2">
          <option value="all">All</option>
          <option value="fractional">Allows fractions</option>
          <option value="whole_only">Whole only</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Conversion</span>
        <Select value={hasConversion} onChange={(event) => onHasConversionChange(event.target.value as "all" | "with_conversion" | "without_conversion")} className="h-10 py-2">
          <option value="all">All</option>
          <option value="with_conversion">Has conversion</option>
          <option value="without_conversion">No conversion</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Base Unit</span>
        <Select value={baseUnitId} onChange={(event) => onBaseUnitIdChange(event.target.value)} className="h-10 py-2">
          <option value="">All base units</option>
          {baseUnitOptions.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>
          ))}
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Sort by</span>
        <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value as UnitSortKey)} className="h-10 py-2">
          <option value="code_asc">Code (A-Z)</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="category_asc">Category</option>
          <option value="measurement_system_asc">Measurement system</option>
          <option value="unit_type_asc">Unit type</option>
          <option value="is_system_desc">Source (System first)</option>
          <option value="sort_order_asc">Sort order</option>
          <option value="updated_at_desc">Updated (Newest)</option>
        </Select>
      </label>
    </FilterToolbar>
  );
}
