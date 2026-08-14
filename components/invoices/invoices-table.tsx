"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  EnterpriseTable,
  EnterpriseTableBody,
  EnterpriseTableCell,
  EnterpriseTableHead,
  EnterpriseTableHeading,
  EnterpriseTableRow,
} from "@/components/ui";
import { formatInvoiceDate } from "@/lib/invoices";
import { formatUsd } from "@/lib/invoices/calculations";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status";
import type { InvoiceDirectoryItem } from "@/components/invoices/types";

type SortField = "invoiceNumber" | "customerName" | "projectName" | "status" | "issueDate" | "dueDate" | "totalAmount" | "balanceDue" | "updatedAt";

type InvoicesTableProps = {
  items: InvoiceDirectoryItem[];
  localeTag: string;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
};

export function InvoicesTable({
  items,
  localeTag,
  sortField,
  sortDirection,
  onSort,
}: InvoicesTableProps) {
  const router = useRouter();

  return (
    <EnterpriseTable ariaLabel="Invoices directory" minWidthClassName="min-w-[1320px]">
      <EnterpriseTableHead>
        <tr>
          <SortableHeading field="invoiceNumber" activeField={sortField} direction={sortDirection} onSort={onSort}>Invoice Number</SortableHeading>
          <EnterpriseTableHeading>Customer</EnterpriseTableHeading>
          <EnterpriseTableHeading>Project</EnterpriseTableHeading>
          <SortableHeading field="status" activeField={sortField} direction={sortDirection} onSort={onSort}>Status</SortableHeading>
          <SortableHeading field="issueDate" activeField={sortField} direction={sortDirection} onSort={onSort}>Issue Date</SortableHeading>
          <SortableHeading field="dueDate" activeField={sortField} direction={sortDirection} onSort={onSort}>Due Date</SortableHeading>
          <SortableHeading field="totalAmount" activeField={sortField} direction={sortDirection} onSort={onSort} align="right">Amount</SortableHeading>
          <SortableHeading field="balanceDue" activeField={sortField} direction={sortDirection} onSort={onSort} align="right">Balance Due</SortableHeading>
          <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
        </tr>
      </EnterpriseTableHead>

      <EnterpriseTableBody>
        {items.map((item) => (
          <EnterpriseTableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${item.id}`)}>
            <EnterpriseTableCell className="font-semibold">{item.invoiceNumber}</EnterpriseTableCell>
            <EnterpriseTableCell>{item.customerName}</EnterpriseTableCell>
            <EnterpriseTableCell>{item.projectName}</EnterpriseTableCell>
            <EnterpriseTableCell>
              <InvoiceStatusBadge status={item.status} />
            </EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{formatInvoiceDate(item.issueDate, localeTag, "Not set")}</EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{formatInvoiceDate(item.dueDate, localeTag, "Not set")}</EnterpriseTableCell>
            <EnterpriseTableCell align="right" className="font-semibold">{formatUsd(item.totalAmount, localeTag)}</EnterpriseTableCell>
            <EnterpriseTableCell align="right" className="font-semibold">{formatUsd(item.balanceDue, localeTag)}</EnterpriseTableCell>
            <EnterpriseTableCell align="right">
              <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                <Link href={`/invoices/${item.id}`} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                  View
                </Link>
                <Link href={`/invoices/${item.id}/edit`} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                  Edit
                </Link>
              </div>
            </EnterpriseTableCell>
          </EnterpriseTableRow>
        ))}
      </EnterpriseTableBody>
    </EnterpriseTable>
  );
}

function SortableHeading({
  field,
  activeField,
  direction,
  onSort,
  align,
  children,
}: {
  field: SortField;
  activeField: SortField;
  direction: "asc" | "desc";
  onSort: (field: SortField) => void;
  align?: "left" | "right";
  children: ReactNode;
}) {
  const isActive = activeField === field;
  const icon = !isActive ? "" : direction === "asc" ? "↑" : "↓";

  return (
    <EnterpriseTableHeading align={align}>
      <button type="button" className="inline-flex items-center gap-1" onClick={() => onSort(field)}>
        <span>{children}</span>
        <span aria-hidden="true" className="text-[0.7rem] text-[var(--color-text-muted)]">{icon}</span>
      </button>
    </EnterpriseTableHeading>
  );
}
