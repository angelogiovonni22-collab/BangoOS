"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  Button,
  EnterpriseTable,
  EnterpriseTableBody,
  EnterpriseTableCell,
  EnterpriseTableHead,
  EnterpriseTableHeading,
  EnterpriseTableRow,
} from "@/components/ui";
import { ChangeOrderStatusBadge } from "@/components/change-orders/change-order-status";
import { formatChangeOrderStatusLabel } from "@/lib/change-orders/statuses";
import { formatUsd } from "@/lib/change-orders/calculations";
import type { ChangeOrderDirectoryItem } from "@/components/change-orders/types";

type SortField = "changeOrderNumber" | "title" | "status" | "scheduleImpactDays" | "totalAmount" | "requestedDate" | "updatedAt";

type ChangeOrdersTableProps = {
  items: ChangeOrderDirectoryItem[];
  localeTag: string;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
  onArchive: (changeOrderId: string) => void;
  onRestore: (changeOrderId: string) => void;
};

export function ChangeOrdersTable({
  items,
  localeTag,
  sortField,
  sortDirection,
  onSort,
  onArchive,
  onRestore,
}: ChangeOrdersTableProps) {
  const router = useRouter();

  return (
    <EnterpriseTable ariaLabel="Change orders directory" minWidthClassName="min-w-[1460px]">
      <EnterpriseTableHead>
        <tr>
          <SortableHeading field="changeOrderNumber" activeField={sortField} direction={sortDirection} onSort={onSort}>Change Order</SortableHeading>
          <SortableHeading field="title" activeField={sortField} direction={sortDirection} onSort={onSort}>Title</SortableHeading>
          <EnterpriseTableHeading>Customer</EnterpriseTableHeading>
          <EnterpriseTableHeading>Project</EnterpriseTableHeading>
          <SortableHeading field="status" activeField={sortField} direction={sortDirection} onSort={onSort}>Status</SortableHeading>
          <SortableHeading field="scheduleImpactDays" activeField={sortField} direction={sortDirection} onSort={onSort}>Schedule Impact</SortableHeading>
          <SortableHeading field="totalAmount" activeField={sortField} direction={sortDirection} onSort={onSort} align="right">Total</SortableHeading>
          <SortableHeading field="requestedDate" activeField={sortField} direction={sortDirection} onSort={onSort}>Requested Date</SortableHeading>
          <SortableHeading field="updatedAt" activeField={sortField} direction={sortDirection} onSort={onSort}>Updated</SortableHeading>
          <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
        </tr>
      </EnterpriseTableHead>

      <EnterpriseTableBody>
        {items.map((item) => (
          <EnterpriseTableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/change-orders/${item.id}`)}>
            <EnterpriseTableCell className="font-semibold">{item.changeOrderNumber}</EnterpriseTableCell>
            <EnterpriseTableCell>
              <Link href={`/change-orders/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]" onClick={(event) => event.stopPropagation()}>
                {item.title}
              </Link>
            </EnterpriseTableCell>
            <EnterpriseTableCell>{item.customerName}</EnterpriseTableCell>
            <EnterpriseTableCell>{item.projectName}</EnterpriseTableCell>
            <EnterpriseTableCell>
              <ChangeOrderStatusBadge status={item.status} />
            </EnterpriseTableCell>
            <EnterpriseTableCell>
              <span className={item.scheduleImpactDays > 0 ? "text-[var(--color-warning-700)]" : item.scheduleImpactDays < 0 ? "text-[var(--color-success-700)]" : "text-[var(--color-text-secondary)]"}>
                {item.scheduleImpactDays > 0 ? "+" : ""}{item.scheduleImpactDays} days
              </span>
            </EnterpriseTableCell>
            <EnterpriseTableCell align="right" className="font-semibold">{formatUsd(item.totalAmount, localeTag)}</EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{item.requestedDate || "Not set"}</EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{new Date(item.updatedAt).toLocaleDateString(localeTag)}</EnterpriseTableCell>
            <EnterpriseTableCell align="right">
              <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                <Link href={`/change-orders/${item.id}`} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                  View
                </Link>
                <Link href={`/change-orders/${item.id}/edit`} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                  Edit
                </Link>
                {item.archivedAt ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => onRestore(item.id)}>
                    Restore
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" size="sm" onClick={() => onArchive(item.id)} disabled={formatChangeOrderStatusLabel(item.status) === "Void"}>
                    Archive
                  </Button>
                )}
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
