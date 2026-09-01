"use client";

import { useMemo, useState } from "react";
import { Button, ErrorState, SkeletonLoader, SummaryCard, TableContainer } from "@/components/ui";
import {
  ChangeOrderDirectoryEmptyState,
  ChangeOrderDirectoryFilteredEmptyState,
} from "@/components/change-orders/change-order-empty-state";
import { ChangeOrdersFilters } from "@/components/change-orders/change-orders-filters";
import { ChangeOrdersTable } from "@/components/change-orders/change-orders-table";
import { formatChangeOrderStatusLabel, normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";
import { formatUsd } from "@/lib/change-orders/calculations";
import type { ChangeOrderDirectoryItem } from "@/components/change-orders/types";

type SortField = "changeOrderNumber" | "title" | "status" | "scheduleImpactDays" | "totalAmount" | "requestedDate" | "updatedAt";

const PAGE_SIZE = 10;

export function ChangeOrdersDirectory({
  items,
  customerOptions,
  projectOptions,
  localeTag,
  isLoading,
  errorMessage,
  onArchive,
  onRestore,
}: {
  items: ChangeOrderDirectoryItem[];
  customerOptions: Array<{ value: string; label: string }>;
  projectOptions: Array<{ value: string; label: string }>;
  localeTag: string;
  isLoading: boolean;
  errorMessage: string | null;
  onArchive: (changeOrderId: string) => Promise<void>;
  onRestore: (changeOrderId: string) => Promise<void>;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [customerValue, setCustomerValue] = useState("all");
  const [projectValue, setProjectValue] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [archivedValue, setArchivedValue] = useState("active");

  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const statusOptions = useMemo(() => {
    const available = new Set(items.map((item) => normalizeChangeOrderStatus(item.status)));

    return [
      { value: "all", label: "All Statuses" },
      ...Array.from(available).map((status) => ({
        value: status,
        label: formatChangeOrderStatusLabel(status),
      })),
    ];
  }, [items]);

  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const searchText = [item.changeOrderNumber, item.title, item.customerName, item.projectName, item.description || ""].join(" ").toLowerCase();
      const matchesSearch = !normalizedSearch || searchText.includes(normalizedSearch);
      const matchesStatus = statusValue === "all" || normalizeChangeOrderStatus(item.status) === statusValue;
      const matchesCustomer = customerValue === "all" || item.customerId === customerValue;
      const matchesProject = projectValue === "all" || item.projectId === projectValue;

      const requestedDate = item.requestedDate ? new Date(`${item.requestedDate}T00:00:00`) : null;
      const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      const endDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

      const matchesDateFrom = !startDate || (!!requestedDate && requestedDate >= startDate);
      const matchesDateTo = !endDate || (!!requestedDate && requestedDate <= endDate);

      const isArchived = !!item.archivedAt;
      const matchesArchived = archivedValue === "all" || (archivedValue === "archived" ? isArchived : !isArchived);

      return matchesSearch && matchesStatus && matchesCustomer && matchesProject && matchesDateFrom && matchesDateTo && matchesArchived;
    });

    return [...filtered].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      const compareText = (left: string, right: string) => left.localeCompare(right) * multiplier;
      const compareNumber = (left: number, right: number) => (left - right) * multiplier;
      const compareDate = (left: string | null, right: string | null) => {
        const leftValue = left ? new Date(left).getTime() : 0;
        const rightValue = right ? new Date(right).getTime() : 0;
        return (leftValue - rightValue) * multiplier;
      };

      if (sortField === "changeOrderNumber") return compareText(a.changeOrderNumber, b.changeOrderNumber);
      if (sortField === "title") return compareText(a.title, b.title);
      if (sortField === "status") return compareText(normalizeChangeOrderStatus(a.status), normalizeChangeOrderStatus(b.status));
      if (sortField === "scheduleImpactDays") return compareNumber(a.scheduleImpactDays, b.scheduleImpactDays);
      if (sortField === "totalAmount") return compareNumber(a.totalAmount, b.totalAmount);
      if (sortField === "requestedDate") return compareDate(a.requestedDate, b.requestedDate);
      return compareDate(a.updatedAt, b.updatedAt);
    });
  }, [items, searchValue, statusValue, customerValue, projectValue, dateFrom, dateTo, archivedValue, sortField, sortDirection]);

  const summary = useMemo(() => {
    const total = items.length;
    const draft = items.filter((item) => normalizeChangeOrderStatus(item.status) === "draft").length;
    const pending = items.filter((item) => normalizeChangeOrderStatus(item.status) === "pending_approval").length;
    const approved = items.filter((item) => normalizeChangeOrderStatus(item.status) === "approved").length;
    const rejected = items.filter((item) => normalizeChangeOrderStatus(item.status) === "rejected").length;
    const approvedValue = items
      .filter((item) => ["approved", "invoiced"].includes(normalizeChangeOrderStatus(item.status)))
      .reduce((sum, item) => sum + item.totalAmount, 0);

    return { total, draft, pending, approved, rejected, approvedValue };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filteredAndSortedItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  }

  function chooseStatus(status: string) {
    setStatusValue((current) => current === status && status !== "all" ? "all" : status);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-6" aria-label="Change order summary filters">
        <SummaryCard icon={<span className="text-sm font-bold">#</span>} label="Total" value={String(summary.total)} onClick={() => chooseStatus("all")} selected={statusValue === "all"} actionLabel="Show all change orders" />
        <SummaryCard icon={<span className="text-sm font-bold">D</span>} label="Draft" value={String(summary.draft)} tone="neutral" onClick={() => chooseStatus("draft")} selected={statusValue === "draft"} actionLabel="Show draft change orders" />
        <SummaryCard icon={<span className="text-sm font-bold">P</span>} label="Pending Approval" value={String(summary.pending)} tone="warning" onClick={() => chooseStatus("pending_approval")} selected={statusValue === "pending_approval"} actionLabel="Show change orders pending approval" />
        <SummaryCard icon={<span className="text-sm font-bold">A</span>} label="Approved" value={String(summary.approved)} tone="success" onClick={() => chooseStatus("approved")} selected={statusValue === "approved"} actionLabel="Show approved change orders" />
        <SummaryCard icon={<span className="text-sm font-bold">R</span>} label="Rejected" value={String(summary.rejected)} tone="danger" onClick={() => chooseStatus("rejected")} selected={statusValue === "rejected"} actionLabel="Show rejected change orders" />
        <SummaryCard icon={<span className="text-sm font-bold">$</span>} label="Total Approved Value" value={formatUsd(summary.approvedValue, localeTag)} tone="info" />
      </section>

      <ChangeOrdersFilters
        searchValue={searchValue}
        statusValue={statusValue}
        customerValue={customerValue}
        projectValue={projectValue}
        dateFrom={dateFrom}
        dateTo={dateTo}
        archivedValue={archivedValue}
        statusOptions={statusOptions}
        customerOptions={[{ value: "all", label: "All Customers" }, ...customerOptions]}
        projectOptions={[{ value: "all", label: "All Projects" }, ...projectOptions]}
        onSearchChange={(value) => {
          setPage(1);
          setSearchValue(value);
        }}
        onStatusChange={(value) => {
          setPage(1);
          setStatusValue(value);
        }}
        onCustomerChange={(value) => {
          setPage(1);
          setCustomerValue(value);
        }}
        onProjectChange={(value) => {
          setPage(1);
          setProjectValue(value);
        }}
        onDateFromChange={(value) => {
          setPage(1);
          setDateFrom(value);
        }}
        onDateToChange={(value) => {
          setPage(1);
          setDateTo(value);
        }}
        onArchivedChange={(value) => {
          setPage(1);
          setArchivedValue(value);
        }}
      />

      <TableContainer
        title="Change Orders Directory"
        description="Track scope changes, approvals, and financial impacts."
      >
        {isLoading ? (
          <div className="p-6 space-y-3">
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
          </div>
        ) : errorMessage ? (
          <div className="p-6">
            <ErrorState title="We couldn't load change orders" description={errorMessage} compact />
          </div>
        ) : filteredAndSortedItems.length > 0 ? (
          <>
            <ChangeOrdersTable
              items={paginatedItems}
              localeTag={localeTag}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
              onArchive={async (changeOrderId) => {
                await onArchive(changeOrderId);
              }}
              onRestore={async (changeOrderId) => {
                await onRestore(changeOrderId);
              }}
            />
            <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] px-5 py-3 text-sm text-[var(--color-text-secondary)]">
              <p>Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filteredAndSortedItems.length)} of {filteredAndSortedItems.length}</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>
                  Previous
                </Button>
                <span>Page {safePage} of {totalPages}</span>
                <Button type="button" variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : items.length === 0 ? (
          <ChangeOrderDirectoryEmptyState />
        ) : (
          <ChangeOrderDirectoryFilteredEmptyState />
        )}
      </TableContainer>
    </div>
  );
}