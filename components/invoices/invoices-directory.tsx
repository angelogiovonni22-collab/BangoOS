"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, ErrorState, SkeletonLoader, SummaryCard, TableContainer } from "@/components/ui";
import { InvoiceDirectoryEmptyState, InvoiceDirectoryFilteredEmptyState } from "@/components/invoices/invoice-empty-state";
import { InvoicesFilters } from "@/components/invoices/invoices-filters";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { formatInvoiceStatusLabel, normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import type { InvoiceDirectoryItem } from "@/components/invoices/types";

type SortField = "invoiceNumber" | "customerName" | "projectName" | "status" | "issueDate" | "dueDate" | "totalAmount" | "balanceDue" | "updatedAt";

const PAGE_SIZE = 10;

export function InvoicesDirectory({
  items,
  customerOptions,
  projectOptions,
  localeTag,
  isLoading,
  errorMessage,
}: {
  items: InvoiceDirectoryItem[];
  customerOptions: Array<{ value: string; label: string }>;
  projectOptions: Array<{ value: string; label: string }>;
  localeTag: string;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [customerValue, setCustomerValue] = useState("all");
  const [projectValue, setProjectValue] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const statusOptions = useMemo(() => {
    const available = new Set(items.map((item) => normalizeInvoiceStatus(item.status)));

    return [
      { value: "all", label: "All Statuses" },
      ...Array.from(available).map((status) => ({
        value: status,
        label: formatInvoiceStatusLabel(status),
      })),
    ];
  }, [items]);

  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const searchText = [item.invoiceNumber, item.title, item.customerName, item.projectName].join(" ").toLowerCase();
      const matchesSearch = !normalizedSearch || searchText.includes(normalizedSearch);
      const matchesStatus = statusValue === "all" || normalizeInvoiceStatus(item.status) === statusValue;
      const matchesCustomer = customerValue === "all" || item.customerId === customerValue;
      const matchesProject = projectValue === "all" || item.projectId === projectValue;

      const issueDate = item.issueDate ? new Date(`${item.issueDate}T00:00:00`) : null;
      const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      const endDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

      const matchesDateFrom = !startDate || (!!issueDate && issueDate >= startDate);
      const matchesDateTo = !endDate || (!!issueDate && issueDate <= endDate);

      return matchesSearch && matchesStatus && matchesCustomer && matchesProject && matchesDateFrom && matchesDateTo;
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

      if (sortField === "invoiceNumber") {
        return compareText(a.invoiceNumber, b.invoiceNumber);
      }

      if (sortField === "customerName") {
        return compareText(a.customerName, b.customerName);
      }

      if (sortField === "projectName") {
        return compareText(a.projectName, b.projectName);
      }

      if (sortField === "status") {
        return compareText(normalizeInvoiceStatus(a.status), normalizeInvoiceStatus(b.status));
      }

      if (sortField === "issueDate") {
        return compareDate(a.issueDate, b.issueDate);
      }

      if (sortField === "dueDate") {
        return compareDate(a.dueDate, b.dueDate);
      }

      if (sortField === "totalAmount") {
        return compareNumber(a.totalAmount, b.totalAmount);
      }

      if (sortField === "balanceDue") {
        return compareNumber(a.balanceDue, b.balanceDue);
      }

      return compareDate(a.updatedAt, b.updatedAt);
    });
  }, [items, searchValue, statusValue, customerValue, projectValue, dateFrom, dateTo, sortField, sortDirection]);

  const summary = useMemo(() => {
    const totalInvoices = items.length;
    const draft = items.filter((item) => normalizeInvoiceStatus(item.status) === "draft").length;
    const sent = items.filter((item) => normalizeInvoiceStatus(item.status) === "sent").length;
    const outstanding = items.filter((item) => item.balanceDue > 0 && normalizeInvoiceStatus(item.status) !== "void").length;
    const paid = items.filter((item) => normalizeInvoiceStatus(item.status) === "paid").length;
    const overdue = items.filter((item) => normalizeInvoiceStatus(item.status) === "overdue").length;

    return { totalInvoices, draft, sent, outstanding, paid, overdue };
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

  return (
    <div className="space-y-6">
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryCard icon={<span className="text-sm font-bold">#</span>} label="Total Invoices" value={String(summary.totalInvoices)} />
        <SummaryCard icon={<span className="text-sm font-bold">D</span>} label="Draft" value={String(summary.draft)} tone="neutral" />
        <SummaryCard icon={<span className="text-sm font-bold">S</span>} label="Sent" value={String(summary.sent)} tone="info" />
        <SummaryCard icon={<span className="text-sm font-bold">O</span>} label="Outstanding" value={String(summary.outstanding)} tone="warning" />
        <SummaryCard icon={<span className="text-sm font-bold">P</span>} label="Paid" value={String(summary.paid)} tone="success" />
        <SummaryCard icon={<span className="text-sm font-bold">!</span>} label="Overdue" value={String(summary.overdue)} tone="danger" />
      </section>

      <InvoicesFilters
        searchValue={searchValue}
        statusValue={statusValue}
        customerValue={customerValue}
        projectValue={projectValue}
        dateFrom={dateFrom}
        dateTo={dateTo}
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
      />

      <TableContainer
        title="Invoice Directory"
        description="Search, filter, and manage invoice records."
        controls={(
          <Link href="/invoices/new">
            <Button size="sm">New Invoice</Button>
          </Link>
        )}
      >
        {isLoading ? (
          <div className="p-6 space-y-3">
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
            <SkeletonLoader className="h-10 w-full" />
          </div>
        ) : errorMessage ? (
          <div className="p-6">
            <ErrorState title="We couldn't load invoices" description={errorMessage} compact />
          </div>
        ) : filteredAndSortedItems.length > 0 ? (
          <>
            <InvoicesTable
              items={paginatedItems}
              localeTag={localeTag}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
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
          <InvoiceDirectoryEmptyState />
        ) : (
          <InvoiceDirectoryFilteredEmptyState />
        )}
      </TableContainer>
    </div>
  );
}
