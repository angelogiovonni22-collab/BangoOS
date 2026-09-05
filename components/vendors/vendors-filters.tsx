"use client";

import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";
import type { VendorSortKey, VendorStatus } from "@/lib/vendors";

type VendorsFiltersProps = {
  query: string;
  status: VendorStatus | "all";
  preferred: "all" | "preferred" | "standard";
  sortBy: VendorSortKey;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: VendorStatus | "all") => void;
  onPreferredChange: (value: "all" | "preferred" | "standard") => void;
  onSortByChange: (value: VendorSortKey) => void;
  activeFilters: number;
};

export function VendorsFilters({ query, status, preferred, sortBy, onQueryChange, onStatusChange, onPreferredChange, onSortByChange, activeFilters }: VendorsFiltersProps) {
  const { term } = useAdaptiveBos();
  const vendorLabel = term("vendor", "Vendor");
  const vendorsLabel = term("vendors", "Vendors");

  return (
    <FilterToolbar
      gridClassName="md:grid-cols-2 xl:grid-cols-4"
      footer={<p className="text-xs font-medium text-[var(--color-text-secondary)]">Active filters: {activeFilters}</p>}
    >
      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Search</span>
        <SearchInput
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={`Search ${vendorsLabel.toLowerCase()} by code, name, contact, or email`}
          aria-label={`Search ${vendorsLabel.toLowerCase()}`}
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Status</span>
        <Select value={status} onChange={(event) => onStatusChange(event.target.value as VendorStatus | "all")} className="h-10 py-2">
          <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="probation">Probation</option><option value="suspended">Suspended</option><option value="archived">Archived</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Preferred</span>
        <Select value={preferred} onChange={(event) => onPreferredChange(event.target.value as "all" | "preferred" | "standard")} className="h-10 py-2">
          <option value="all">All {vendorsLabel}</option>
          <option value="preferred">Preferred {vendorsLabel}</option>
          <option value="standard">Standard {vendorsLabel}</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Sort by</span>
        <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value as VendorSortKey)} className="h-10 py-2">
          <option value="display_name_asc">Display name (A-Z)</option>
          <option value="display_name_desc">Display name (Z-A)</option>
          <option value="vendor_code_asc">{vendorLabel} code (A-Z)</option>
          <option value="status_asc">Status</option>
          <option value="quality_desc">Quality rating (High-Low)</option>
          <option value="created_at_desc">Newest first</option>
        </Select>
      </label>
    </FilterToolbar>
  );
}
