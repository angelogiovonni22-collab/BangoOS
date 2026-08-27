"use client";

import { useMemo, useState } from "react";
import { ErrorState, SkeletonLoader, SummaryCard, TableContainer } from "@/components/ui";
import { EstimateDirectoryEmptyState, EstimateDirectoryFilteredEmptyState } from "@/components/estimates/estimate-empty-state";
import { EstimatesFilters } from "@/components/estimates/estimates-filters";
import { EstimatesTable } from "@/components/estimates/estimates-table";
import { duplicateEstimate, archiveEstimate } from "@/lib/estimates/service";
import { createClient } from "@/lib/supabase/client";
import type { EstimateDirectoryItem } from "@/components/estimates/types";

export function EstimatesDirectory({
  items,
  customerOptions,
  projectOptions,
  localeTag,
  companyId,
  userId,
  onMutationComplete,
  isLoading,
  errorMessage,
}: {
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
  const [isMutating, setIsMutating] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [customerValue, setCustomerValue] = useState("all");
  const [projectValue, setProjectValue] = useState("all");
  const [datePreset, setDatePreset] = useState("all");

  const [sortField, setSortField] = useState<"estimateNumber" | "title" | "status" | "issueDate" | "expirationDate" | "totalAmount" | "updatedAt">("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const statusOptions = useMemo(() => {
    const available = new Set(items.map((item) => item.status));

    return [
      { value: "all", label: "All Statuses" },
      ...Array.from(available).map((status) => ({
        value: status,
        label: status
          .split("_")
          .map((word) => word[0]?.toUpperCase() + word.slice(1))
          .join(" "),
      })),
    ];
  }, [items]);

  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
    const fourteenDaysOut = new Date();
    fourteenDaysOut.setUTCDate(fourteenDaysOut.getUTCDate() + 14);

    const filtered = items.filter((item) => {
      const searchText = [item.estimateNumber, item.title, item.customerName, item.projectName].join(" ").toLowerCase();
      const matchesSearch = !normalizedSearch || searchText.includes(normalizedSearch);
      const matchesStatus = statusValue === "all" || item.status === statusValue;
      const matchesCustomer = customerValue === "all" || item.customerId === customerValue;
      const matchesProject = projectValue === "all" || item.projectId === projectValue;

      const issueDate = item.issueDate ? new Date(`${item.issueDate}T00:00:00`) : null;
      const expirationDate = item.expirationDate ? new Date(`${item.expirationDate}T00:00:00`) : null;

      let matchesDate = true;

      if (datePreset === "this_month") {
        matchesDate = !!issueDate && issueDate >= thisMonthStart;
      }

      if (datePreset === "last_30") {
        matchesDate = !!issueDate && issueDate >= thirtyDaysAgo;
      }

      if (datePreset === "expiring_soon") {
        matchesDate = !!expirationDate && expirationDate >= now && expirationDate <= fourteenDaysOut;
      }

      if (datePreset === "expired") {
        matchesDate = !!expirationDate && expirationDate < now;
      }

      return matchesSearch && matchesStatus && matchesCustomer && matchesProject && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      const compareText = (left: string, right: string) => left.localeCompare(right) * multiplier;
      const compareNumber = (left: number, right: number) => (left - right) * multiplier;
      const compareDate = (left: string | null, right: string | null) => {
        const leftValue = left ? new Date(`${left}T00:00:00`).getTime() : 0;
        const rightValue = right ? new Date(`${right}T00:00:00`).getTime() : 0;
        return (leftValue - rightValue) * multiplier;
      };

      if (sortField === "estimateNumber") {
        return compareText(a.estimateNumber, b.estimateNumber);
      }

      if (sortField === "title") {
        return compareText(a.title, b.title);
      }

      if (sortField === "status") {
        return compareText(a.status, b.status);
      }

      if (sortField === "issueDate") {
        return compareDate(a.issueDate, b.issueDate);
      }

      if (sortField === "expirationDate") {
        return compareDate(a.expirationDate, b.expirationDate);
      }

      if (sortField === "totalAmount") {
        return compareNumber(a.totalAmount, b.totalAmount);
      }

      return compareDate(a.updatedAt, b.updatedAt);
    });
  }, [items, searchValue, statusValue, customerValue, projectValue, datePreset, sortField, sortDirection]);

  const summary = useMemo(() => {
    const totalEstimates = items.length;
    const draft = items.filter((item) => item.status === "draft").length;
    const sent = items.filter((item) => item.status === "sent").length;
    const approved = items.filter((item) => item.status === "approved").length;
    const totalValue = items.reduce((sum, item) => sum + item.totalAmount, 0);

    const currency = new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(totalValue);

    return { totalEstimates, draft, sent, approved, totalValue: currency };
  }, [items, localeTag]);

  async function handleDuplicate(estimateId: string) {
    if (!supabase || isMutating) {
      return;
    }

    setIsMutating(true);

    try {
      const result = await duplicateEstimate({
        supabase,
        companyId,
        userId,
        estimateId,
      });

      if (!result.error) {
        await onMutationComplete();
      }
    } finally {
      setIsMutating(false);
    }
  }

  async function handleArchive(estimateId: string) {
    if (!supabase || isMutating) {
      return;
    }

    setIsMutating(true);

    try {
      const result = await archiveEstimate({
        supabase,
        companyId,
        userId,
        estimateId,
      });

      if (!result.error) {
        await onMutationComplete();
      }
    } finally {
      setIsMutating(false);
    }
  }

  function handleSort(field: "estimateNumber" | "title" | "status" | "issueDate" | "expirationDate" | "totalAmount" | "updatedAt") {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon={<span className="text-sm font-bold">#</span>} label="Total Estimates" value={String(summary.totalEstimates)} tone="brand" compact />
        <SummaryCard icon={<span className="text-sm font-bold">D</span>} label="Draft" value={String(summary.draft)} tone="analytics" compact />
        <SummaryCard icon={<span className="text-sm font-bold">S</span>} label="Sent" value={String(summary.sent)} tone="sent" compact />
        <SummaryCard icon={<span className="text-sm font-bold">A</span>} label="Approved" value={String(summary.approved)} tone="successLight" compact />
        <SummaryCard icon={<span className="text-sm font-bold">$</span>} label="Total Estimated Value" value={summary.totalValue} tone="successDark" compact />
      </section>

      <EstimatesFilters
        searchValue={searchValue}
        statusValue={statusValue}
        customerValue={customerValue}
        projectValue={projectValue}
        datePresetValue={datePreset}
        statusOptions={statusOptions}
        customerOptions={[{ value: "all", label: "All Customers" }, ...customerOptions]}
        projectOptions={[{ value: "all", label: "All Projects" }, ...projectOptions]}
        onSearchChange={setSearchValue}
        onStatusChange={setStatusValue}
        onCustomerChange={setCustomerValue}
        onProjectChange={setProjectValue}
        onDatePresetChange={setDatePreset}
      />

      <TableContainer title="Estimate Directory" description="Search, filter, and manage estimate records.">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
          </div>
        ) : errorMessage ? (
          <div className="p-6">
            <ErrorState title="We couldn't load estimates" description={errorMessage} compact />
          </div>
        ) : filteredAndSortedItems.length > 0 ? (
          <EstimatesTable
            items={filteredAndSortedItems}
            localeTag={localeTag}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
            onDuplicate={handleDuplicate}
            onArchive={handleArchive}
          />
        ) : items.length === 0 ? (
          <EstimateDirectoryEmptyState />
        ) : (
          <EstimateDirectoryFilteredEmptyState />
        )}
      </TableContainer>
    </div>
  );
}
