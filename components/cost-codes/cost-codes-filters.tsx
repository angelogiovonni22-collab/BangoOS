import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import type { CostCodeSortKey, CostCodeStatus } from "@/lib/cost-codes";

type CostCodesFiltersProps = {
  query: string;
  status: CostCodeStatus | "all";
  division: string;
  hierarchyMode: "all" | "parent" | "child";
  sortBy: CostCodeSortKey;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: CostCodeStatus | "all") => void;
  onDivisionChange: (value: string) => void;
  onHierarchyModeChange: (value: "all" | "parent" | "child") => void;
  onSortByChange: (value: CostCodeSortKey) => void;
  activeFilters: number;
};

export function CostCodesFilters({
  query,
  status,
  division,
  hierarchyMode,
  sortBy,
  onQueryChange,
  onStatusChange,
  onDivisionChange,
  onHierarchyModeChange,
  onSortByChange,
  activeFilters,
}: CostCodesFiltersProps) {
  return (
    <FilterToolbar
      gridClassName="md:grid-cols-2 xl:grid-cols-6"
      footer={<p className="text-xs font-medium text-[var(--color-text-secondary)]">Active filters: {activeFilters}</p>}
    >
      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)] xl:col-span-2">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Search</span>
        <SearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by code, name, division, category, or trade"
          aria-label="Search cost codes"
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Status</span>
        <Select value={status} onChange={(event) => onStatusChange(event.target.value as CostCodeStatus | "all")} className="h-10 py-2">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Division</span>
        <SearchInput
          value={division}
          onChange={(event) => onDivisionChange(event.target.value)}
          placeholder="Filter division"
          aria-label="Filter division"
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Hierarchy</span>
        <Select value={hierarchyMode} onChange={(event) => onHierarchyModeChange(event.target.value as "all" | "parent" | "child")} className="h-10 py-2">
          <option value="all">All</option>
          <option value="parent">Parents only</option>
          <option value="child">Children only</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Sort by</span>
        <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value as CostCodeSortKey)} className="h-10 py-2">
          <option value="code_asc">Code (A-Z)</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="status_asc">Status</option>
          <option value="budget_desc">Budget (High-Low)</option>
          <option value="actual_cost_desc">Actual cost (High-Low)</option>
          <option value="created_at_desc">Newest first</option>
        </Select>
      </label>
    </FilterToolbar>
  );
}