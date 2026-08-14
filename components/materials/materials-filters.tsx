import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import type { MaterialSortKey, MaterialStatus } from "@/lib/materials";

type MaterialsFiltersProps = {
  query: string;
  status: MaterialStatus | "all";
  inventoryMode: "all" | "tracked" | "not_tracked";
  category: string;
  sortBy: MaterialSortKey;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: MaterialStatus | "all") => void;
  onInventoryModeChange: (value: "all" | "tracked" | "not_tracked") => void;
  onCategoryChange: (value: string) => void;
  onSortByChange: (value: MaterialSortKey) => void;
  activeFilters: number;
};

export function MaterialsFilters({
  query,
  status,
  inventoryMode,
  category,
  sortBy,
  onQueryChange,
  onStatusChange,
  onInventoryModeChange,
  onCategoryChange,
  onSortByChange,
  activeFilters,
}: MaterialsFiltersProps) {
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
          placeholder="Search code, name, category, trade, or vendor"
          aria-label="Search materials"
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Status</span>
        <Select value={status} onChange={(event) => onStatusChange(event.target.value as MaterialStatus | "all")} className="h-10 py-2">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="discontinued">Discontinued</option>
          <option value="archived">Archived</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Inventory</span>
        <Select value={inventoryMode} onChange={(event) => onInventoryModeChange(event.target.value as "all" | "tracked" | "not_tracked")} className="h-10 py-2">
          <option value="all">All</option>
          <option value="tracked">Tracked</option>
          <option value="not_tracked">Not tracked</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Category</span>
        <SearchInput
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          placeholder="Filter category"
          aria-label="Filter category"
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Sort by</span>
        <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value as MaterialSortKey)} className="h-10 py-2">
          <option value="name_asc">Name (A-Z)</option>
          <option value="material_code_asc">Material code (A-Z)</option>
          <option value="status_asc">Status</option>
          <option value="current_stock_desc">Stock (High-Low)</option>
          <option value="standard_cost_desc">Standard cost (High-Low)</option>
          <option value="created_at_desc">Newest first</option>
        </Select>
      </label>
    </FilterToolbar>
  );
}
