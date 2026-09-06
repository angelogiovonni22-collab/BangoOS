"use client";

import { FilterToolbar, SearchInput, Select } from "@/components/ui";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";
import { useI18n } from "@/lib/i18n/provider";
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
  const { t } = useI18n();
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
          aria-label={t("navigation.searchContractorsVendors")}
          className="h-10 py-2"
        />
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Status</span>
        <Select value={status} onChange={(event) => onStatusChange(event.target.value as VendorStatus | "all")} className="h-10 py-2">
          <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="probation">{t("navigation.probation")}</option><option value="suspended">{t("navigation.suspended")}</option><option value="archived">Archived</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Preferred</span>
        <Select value={preferred} onChange={(event) => onPreferredChange(event.target.value as "all" | "preferred" | "standard")} className="h-10 py-2">
          <option value="all">{vendorsLabel === "Contractors & Vendors" ? t("navigation.allContractorsVendors") : `All ${vendorsLabel}`}</option>
          <option value="preferred">{vendorsLabel === "Contractors & Vendors" ? t("navigation.preferredContractorsVendors") : `Preferred ${vendorsLabel}`}</option>
          <option value="standard">{vendorsLabel === "Contractors & Vendors" ? t("navigation.standardContractorsVendors") : `Standard ${vendorsLabel}`}</option>
        </Select>
      </label>

      <label className="space-y-1 text-sm font-semibold text-[var(--color-text-primary)]">
        <span className="text-xs uppercase tracking-[0.04em] text-[var(--color-text-secondary)]">Sort by</span>
        <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value as VendorSortKey)} className="h-10 py-2">
          <option value="display_name_asc">{t("navigation.displayNameAZ")}</option>
          <option value="display_name_desc">{t("navigation.displayNameZA")}</option>
          <option value="vendor_code_asc">{vendorLabel === "Contractor or Vendor" ? `${t("navigation.contractorVendorHeading")} ${t("navigation.codeHeading")} (A-Z)` : `${vendorLabel} code (A-Z)`}</option>
          <option value="status_asc">Status</option>
          <option value="quality_desc">Quality rating (High-Low)</option>
          <option value="created_at_desc">Newest first</option>
        </Select>
      </label>
    </FilterToolbar>
  );
}
