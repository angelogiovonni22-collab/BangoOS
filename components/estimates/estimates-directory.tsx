"use client";

import { useMemo, useState } from "react";
import { ErrorState, SkeletonLoader, SummaryCard, TableContainer } from "@/components/ui";
import { EstimateDirectoryEmptyState, EstimateDirectoryFilteredEmptyState } from "@/components/estimates/estimate-empty-state";
import { EstimatesFilters } from "@/components/estimates/estimates-filters";
import { EstimatesTable } from "@/components/estimates/estimates-table";
import { duplicateEstimate, archiveEstimate } from "@/lib/estimates/service";
import { createClient } from "@/lib/supabase/client";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";
import type { EstimateDirectoryItem } from "@/components/estimates/types";

type SortField = "estimateNumber" | "title" | "status" | "issueDate" | "expirationDate" | "totalAmount" | "updatedAt";

export function EstimatesDirectory({ items, customerOptions, projectOptions, localeTag, companyId, userId, onMutationComplete, isLoading, errorMessage }: {
  items: EstimateDirectoryItem[];
  customerOptions: Array<{ value: string; label: string }>;
  projectOptions: Array<{ value: string; label: string }>;
  localeTag: string;
  companyId: string;
  userId: string;
  onMutationComplete: () => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { term } = useAdaptiveBos();
  const estimateLabel = term("estimate", "Estimate");
  const estimatesLabel = term("estimates", "Estimates");
  const customersLabel = term("customers", "Customers");
  const projectsLabel = term("projects", "Projects");
  const [isMutating, setIsMutating] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [customerValue, setCustomerValue] = useState("all");
  const [projectValue, setProjectValue] = useState("all");
  const [datePreset, setDatePreset] = useState("all");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const statusOptions = useMemo(() => {
    const available = new Set(items.map((item) => item.status));
    return [{ value: "all", label: "All Statuses" }, ...Array.from(available).map((status) => ({ value: status, label: status.split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ") }))];
  }, [items]);

  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const fourteenDaysOut = new Date(); fourteenDaysOut.setUTCDate(fourteenDaysOut.getUTCDate() + 14);
    const filtered = items.filter((item) => {
      const searchText = [item.estimateNumber, item.title, item.customerName, item.projectName].join(" ").toLowerCase();
      const matchesSearch = !normalizedSearch || searchText.includes(normalizedSearch);
      const matchesStatus = statusValue === "all" || item.status === statusValue;
      const matchesCustomer = customerValue === "all" || item.customerId === customerValue;
      const matchesProject = projectValue === "all" || item.projectId === projectValue;
      const issueDate = item.issueDate ? new Date(`${item.issueDate}T00:00:00`) : null;
      const expirationDate = item.expirationDate ? new Date(`${item.expirationDate}T00:00:00`) : null;
      let matchesDate = true;
      if (datePreset === "this_month") matchesDate = !!issueDate && issueDate >= thisMonthStart;
      if (datePreset === "last_30") matchesDate = !!issueDate && issueDate >= thirtyDaysAgo;
      if (datePreset === "expiring_soon") matchesDate = !!expirationDate && expirationDate >= now && expirationDate <= fourteenDaysOut;
      if (datePreset === "expired") matchesDate = !!expirationDate && expirationDate < now;
      return matchesSearch && matchesStatus && matchesCustomer && matchesProject && matchesDate;
    });
    return [...filtered].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      const compareText = (left: string, right: string) => left.localeCompare(right) * multiplier;
      const compareNumber = (left: number, right: number) => (left - right) * multiplier;
      const compareDate = (left: string | null, right: string | null) => ((left ? new Date(`${left}T00:00:00`).getTime() : 0) - (right ? new Date(`${right}T00:00:00`).getTime() : 0)) * multiplier;
      if (sortField === "estimateNumber") return compareText(a.estimateNumber, b.estimateNumber);
      if (sortField === "title") return compareText(a.title, b.title);
      if (sortField === "status") return compareText(a.status, b.status);
      if (sortField === "issueDate") return compareDate(a.issueDate, b.issueDate);
      if (sortField === "expirationDate") return compareDate(a.expirationDate, b.expirationDate);
      if (sortField === "totalAmount") return compareNumber(a.totalAmount, b.totalAmount);
      return compareDate(a.updatedAt, b.updatedAt);
    });
  }, [items, searchValue, statusValue, customerValue, projectValue, datePreset, sortField, sortDirection]);

  const summary = useMemo(() => {
    const totalEstimates = items.length;
    const draft = items.filter((item) => item.status === "draft").length;
    const sent = items.filter((item) => item.status === "sent").length;
    const approved = items.filter((item) => item.status === "approved").length;
    const totalValue = items.reduce((sum, item) => sum + item.totalAmount, 0);
    const currency = new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalValue);
    return { totalEstimates, draft, sent, approved, totalValue: currency };
  }, [items, localeTag]);

  const chooseStatus = (status: string) => setStatusValue((current) => current === status && status !== "all" ? "all" : status);

  async function handleDuplicate(estimateId: string) {
    if (!supabase || isMutating) return;
    setIsMutating(true);
    try { const result = await duplicateEstimate({ supabase, companyId, userId, estimateId }); if (!result.error) await onMutationComplete(); } finally { setIsMutating(false); }
  }

  async function handleArchive(estimateId: string) {
    if (!supabase || isMutating) return;
    setIsMutating(true);
    try { const result = await archiveEstimate({ supabase, companyId, userId, estimateId }); if (!result.error) await onMutationComplete(); } finally { setIsMutating(false); }
  }

  function handleSort(field: SortField) {
    if (sortField === field) { setSortDirection((current) => current === "asc" ? "desc" : "asc"); return; }
    setSortField(field); setSortDirection("asc");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label={`${estimateLabel} summary filters`}>
        <SummaryCard icon={<span>#</span>} label={`Total ${estimatesLabel}`} value={String(summary.totalEstimates)} tone="brand" compact onClick={() => chooseStatus("all")} selected={statusValue === "all"} actionLabel={`Show all ${estimatesLabel.toLowerCase()}`} />
        <SummaryCard icon={<span>D</span>} label="Draft" value={String(summary.draft)} tone="analytics" compact onClick={() => chooseStatus("draft")} selected={statusValue === "draft"} actionLabel={`Show draft ${estimatesLabel.toLowerCase()}`} />
        <SummaryCard icon={<span>S</span>} label="Sent" value={String(summary.sent)} tone="sent" compact onClick={() => chooseStatus("sent")} selected={statusValue === "sent"} actionLabel={`Show sent ${estimatesLabel.toLowerCase()}`} />
        <SummaryCard icon={<span>A</span>} label="Approved" value={String(summary.approved)} tone="successLight" compact onClick={() => chooseStatus("approved")} selected={statusValue === "approved"} actionLabel={`Show approved ${estimatesLabel.toLowerCase()}`} />
        <SummaryCard icon={<span>$</span>} label={`Total ${estimateLabel} Value`} value={summary.totalValue} tone="successDark" compact onClick={() => chooseStatus("all")} selected={false} actionLabel={`Show all ${estimatesLabel.toLowerCase()} represented by total value`} />
      </section>

      <EstimatesFilters searchValue={searchValue} statusValue={statusValue} customerValue={customerValue} projectValue={projectValue} datePresetValue={datePreset} statusOptions={statusOptions} customerOptions={[{ value: "all", label: `All ${customersLabel}` }, ...customerOptions]} projectOptions={[{ value: "all", label: `All ${projectsLabel}` }, ...projectOptions]} onSearchChange={setSearchValue} onStatusChange={setStatusValue} onCustomerChange={setCustomerValue} onProjectChange={setProjectValue} onDatePresetChange={setDatePreset} />

      <TableContainer title={`${estimateLabel} Directory`} description={`Search, filter, and manage ${estimatesLabel.toLowerCase()}.`}>
        {isLoading ? <div className="space-y-3 p-6"><SkeletonLoader className="h-10 w-full" /><SkeletonLoader className="h-10 w-full" /><SkeletonLoader className="h-10 w-full" /></div> : errorMessage ? <div className="p-6"><ErrorState title={`We couldn't load ${estimatesLabel.toLowerCase()}`} description={errorMessage} compact /></div> : filteredAndSortedItems.length > 0 ? <EstimatesTable items={filteredAndSortedItems} localeTag={localeTag} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} onDuplicate={handleDuplicate} onArchive={handleArchive} /> : items.length === 0 ? <EstimateDirectoryEmptyState /> : <EstimateDirectoryFilteredEmptyState />}
      </TableContainer>
    </div>
  );
}
