"use client";

import { useMemo, useState } from "react";
import { Button, ErrorState, SkeletonLoader, SummaryCard, TableContainer } from "@/components/ui";
import { InvoiceDirectoryEmptyState, InvoiceDirectoryFilteredEmptyState } from "@/components/invoices/invoice-empty-state";
import { InvoicesFilters } from "@/components/invoices/invoices-filters";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { formatInvoiceStatusLabel, normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import type { InvoiceDirectoryItem } from "@/components/invoices/types";

type SortField = "invoiceNumber" | "customerName" | "projectName" | "status" | "issueDate" | "dueDate" | "totalAmount" | "balanceDue" | "updatedAt";
type SummaryFilter = "none" | "outstanding";
const PAGE_SIZE = 10;

export function InvoicesDirectory({ items, customerOptions, projectOptions, localeTag, isLoading, errorMessage }: { items: InvoiceDirectoryItem[]; customerOptions: Array<{ value: string; label: string }>; projectOptions: Array<{ value: string; label: string }>; localeTag: string; isLoading: boolean; errorMessage: string | null }) {
  const [searchValue, setSearchValue] = useState("");
  const [statusValue, setStatusValue] = useState("all");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilter>("none");
  const [customerValue, setCustomerValue] = useState("all");
  const [projectValue, setProjectValue] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const statusOptions = useMemo(() => {
    const available = new Set(items.map((item) => normalizeInvoiceStatus(item.status)));
    return [{ value: "all", label: "All Statuses" }, ...Array.from(available).map((status) => ({ value: status, label: formatInvoiceStatusLabel(status) }))];
  }, [items]);

  const filteredAndSortedItems = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const normalizedStatus = normalizeInvoiceStatus(item.status);
      const searchText = [item.invoiceNumber, item.title, item.customerName, item.projectName].join(" ").toLowerCase();
      const issueDate = item.issueDate ? new Date(`${item.issueDate}T00:00:00`) : null;
      const startDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      const endDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;
      return (!normalizedSearch || searchText.includes(normalizedSearch))
        && (statusValue === "all" || normalizedStatus === statusValue)
        && (summaryFilter !== "outstanding" || (item.balanceDue > 0 && normalizedStatus !== "void"))
        && (customerValue === "all" || item.customerId === customerValue)
        && (projectValue === "all" || item.projectId === projectValue)
        && (!startDate || (!!issueDate && issueDate >= startDate))
        && (!endDate || (!!issueDate && issueDate <= endDate));
    });
    return [...filtered].sort((a, b) => {
      const m = sortDirection === "asc" ? 1 : -1;
      const text = (l: string, r: string) => l.localeCompare(r) * m;
      const number = (l: number, r: number) => (l - r) * m;
      const date = (l: string | null, r: string | null) => ((l ? new Date(`${l}T00:00:00`).getTime() : 0) - (r ? new Date(`${r}T00:00:00`).getTime() : 0)) * m;
      if (sortField === "invoiceNumber") return text(a.invoiceNumber, b.invoiceNumber);
      if (sortField === "customerName") return text(a.customerName, b.customerName);
      if (sortField === "projectName") return text(a.projectName, b.projectName);
      if (sortField === "status") return text(normalizeInvoiceStatus(a.status), normalizeInvoiceStatus(b.status));
      if (sortField === "issueDate") return date(a.issueDate, b.issueDate);
      if (sortField === "dueDate") return date(a.dueDate, b.dueDate);
      if (sortField === "totalAmount") return number(a.totalAmount, b.totalAmount);
      if (sortField === "balanceDue") return number(a.balanceDue, b.balanceDue);
      return date(a.updatedAt, b.updatedAt);
    });
  }, [items, searchValue, statusValue, summaryFilter, customerValue, projectValue, dateFrom, dateTo, sortField, sortDirection]);

  const summary = useMemo(() => ({
    totalInvoices: items.length,
    draft: items.filter((item) => normalizeInvoiceStatus(item.status) === "draft").length,
    sent: items.filter((item) => normalizeInvoiceStatus(item.status) === "sent").length,
    outstanding: items.filter((item) => item.balanceDue > 0 && normalizeInvoiceStatus(item.status) !== "void").length,
    paid: items.filter((item) => normalizeInvoiceStatus(item.status) === "paid").length,
    overdue: items.filter((item) => normalizeInvoiceStatus(item.status) === "overdue").length,
  }), [items]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filteredAndSortedItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function chooseStatus(status: string) { setPage(1); setSummaryFilter("none"); setStatusValue((current) => current === status && status !== "all" ? "all" : status); }
  function chooseOutstanding() { setPage(1); setStatusValue("all"); setSummaryFilter((current) => current === "outstanding" ? "none" : "outstanding"); }
  function handleSort(field: SortField) { if (sortField === field) { setSortDirection((current) => current === "asc" ? "desc" : "asc"); return; } setSortField(field); setSortDirection("asc"); }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-6" aria-label="Invoice summary filters">
        <SummaryCard icon={<span>#</span>} label="Total Invoices" value={String(summary.totalInvoices)} onClick={() => chooseStatus("all")} selected={statusValue === "all" && summaryFilter === "none"} actionLabel="Show all invoices" />
        <SummaryCard icon={<span>D</span>} label="Draft" value={String(summary.draft)} tone="neutral" onClick={() => chooseStatus("draft")} selected={statusValue === "draft"} actionLabel="Show draft invoices" />
        <SummaryCard icon={<span>S</span>} label="Sent" value={String(summary.sent)} tone="info" onClick={() => chooseStatus("sent")} selected={statusValue === "sent"} actionLabel="Show sent invoices" />
        <SummaryCard icon={<span>O</span>} label="Outstanding" value={String(summary.outstanding)} tone="warning" onClick={chooseOutstanding} selected={summaryFilter === "outstanding"} actionLabel="Show invoices with outstanding balances" />
        <SummaryCard icon={<span>P</span>} label="Paid" value={String(summary.paid)} tone="success" onClick={() => chooseStatus("paid")} selected={statusValue === "paid"} actionLabel="Show paid invoices" />
        <SummaryCard icon={<span>!</span>} label="Overdue" value={String(summary.overdue)} tone="danger" onClick={() => chooseStatus("overdue")} selected={statusValue === "overdue"} actionLabel="Show overdue invoices" />
      </section>

      <InvoicesFilters searchValue={searchValue} statusValue={statusValue} customerValue={customerValue} projectValue={projectValue} dateFrom={dateFrom} dateTo={dateTo} statusOptions={statusOptions} customerOptions={[{ value: "all", label: "All Customers" }, ...customerOptions]} projectOptions={[{ value: "all", label: "All Projects" }, ...projectOptions]} onSearchChange={(value) => { setPage(1); setSearchValue(value); }} onStatusChange={(value) => { setPage(1); setSummaryFilter("none"); setStatusValue(value); }} onCustomerChange={(value) => { setPage(1); setCustomerValue(value); }} onProjectChange={(value) => { setPage(1); setProjectValue(value); }} onDateFromChange={(value) => { setPage(1); setDateFrom(value); }} onDateToChange={(value) => { setPage(1); setDateTo(value); }} />

      <TableContainer title="Invoice Directory" description="Search, filter, and manage invoice records.">
        {isLoading ? <div className="space-y-3 p-6"><SkeletonLoader className="h-10 w-full" /><SkeletonLoader className="h-10 w-full" /><SkeletonLoader className="h-10 w-full" /></div> : errorMessage ? <div className="p-6"><ErrorState title="We couldn't load invoices" description={errorMessage} compact /></div> : filteredAndSortedItems.length > 0 ? <><InvoicesTable items={paginatedItems} localeTag={localeTag} sortField={sortField} sortDirection={sortDirection} onSort={handleSort} /><div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] px-5 py-3 text-sm text-[var(--color-text-secondary)]"><p>Showing {(safePage - 1) * PAGE_SIZE + 1} to {Math.min(safePage * PAGE_SIZE, filteredAndSortedItems.length)} of {filteredAndSortedItems.length}</p><div className="flex items-center gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>Previous</Button><span>Page {safePage} of {totalPages}</span><Button type="button" variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>Next</Button></div></div></> : items.length === 0 ? <InvoiceDirectoryEmptyState /> : <InvoiceDirectoryFilteredEmptyState />}
      </TableContainer>
    </div>
  );
}
