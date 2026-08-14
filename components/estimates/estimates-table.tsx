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
import { formatEstimateDate } from "@/lib/estimates";
import { formatUsd } from "@/lib/estimates/calculations";
import { EstimateStatusBadge, formatEstimateStatusLabel } from "@/components/estimates/estimate-status";
import type { EstimateDirectoryItem } from "@/components/estimates/types";

type SortField = "estimateNumber" | "title" | "status" | "issueDate" | "expirationDate" | "totalAmount" | "updatedAt";

type EstimatesTableProps = {
  items: EstimateDirectoryItem[];
  localeTag: string;
  sortField: SortField;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
  onDuplicate: (estimateId: string) => void;
  onArchive: (estimateId: string) => void;
};

export function EstimatesTable({
  items,
  localeTag,
  sortField,
  sortDirection,
  onSort,
  onDuplicate,
  onArchive,
}: EstimatesTableProps) {
  const router = useRouter();

  return (
    <EnterpriseTable ariaLabel="Estimates directory" minWidthClassName="min-w-[1460px]">
      <EnterpriseTableHead>
        <tr>
          <SortableHeading field="estimateNumber" activeField={sortField} direction={sortDirection} onSort={onSort}>Estimate Number</SortableHeading>
          <SortableHeading field="title" activeField={sortField} direction={sortDirection} onSort={onSort}>Estimate Name</SortableHeading>
          <EnterpriseTableHeading>Customer</EnterpriseTableHeading>
          <EnterpriseTableHeading>Project</EnterpriseTableHeading>
          <SortableHeading field="status" activeField={sortField} direction={sortDirection} onSort={onSort}>Status</SortableHeading>
          <SortableHeading field="issueDate" activeField={sortField} direction={sortDirection} onSort={onSort}>Estimate Date</SortableHeading>
          <SortableHeading field="expirationDate" activeField={sortField} direction={sortDirection} onSort={onSort}>Expiration Date</SortableHeading>
          <SortableHeading field="totalAmount" activeField={sortField} direction={sortDirection} onSort={onSort} align="right">Total</SortableHeading>
          <SortableHeading field="updatedAt" activeField={sortField} direction={sortDirection} onSort={onSort}>Last Updated</SortableHeading>
          <EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading>
        </tr>
      </EnterpriseTableHead>

      <EnterpriseTableBody>
        {items.map((item) => (
          <EnterpriseTableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/estimates/${item.id}`)}>
            <EnterpriseTableCell className="font-semibold">{item.estimateNumber}</EnterpriseTableCell>
            <EnterpriseTableCell>
              <Link href={`/estimates/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]" onClick={(event) => event.stopPropagation()}>
                {item.title}
              </Link>
            </EnterpriseTableCell>
            <EnterpriseTableCell>{item.customerName}</EnterpriseTableCell>
            <EnterpriseTableCell>{item.projectName}</EnterpriseTableCell>
            <EnterpriseTableCell>
              <EstimateStatusBadge status={item.status} label={formatEstimateStatusLabel(item.status)} />
            </EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{formatEstimateDate(item.issueDate, localeTag, "Not set")}</EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{formatEstimateDate(item.expirationDate, localeTag, "Not set")}</EnterpriseTableCell>
            <EnterpriseTableCell align="right" className="font-semibold">{formatUsd(item.totalAmount, localeTag)}</EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{formatEstimateDate(item.updatedAt, localeTag, "Not set")}</EnterpriseTableCell>
            <EnterpriseTableCell align="right">
              <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                <Link href={`/estimates/${item.id}`} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                  View
                </Link>
                <Link href={`/estimates/${item.id}/edit`} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                  Edit
                </Link>
                <Button type="button" variant="secondary" size="sm" onClick={() => onDuplicate(item.id)}>
                  Duplicate
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onArchive(item.id)} disabled={item.status === "archived"}>
                  Archive
                </Button>
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
