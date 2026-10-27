"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
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
  const { t } = useI18n();

  return (
    <EnterpriseTable ariaLabel={t("finance.changeOrdersDirectoryAria")} minWidthClassName="min-w-[1460px]">
      <EnterpriseTableHead>
        <tr>
          <SortableHeading field="changeOrderNumber" activeField={sortField} direction={sortDirection} onSort={onSort}>{t("finance.changeOrder")}</SortableHeading>
          <SortableHeading field="title" activeField={sortField} direction={sortDirection} onSort={onSort}>{t("finance.changeOrderTitle")}</SortableHeading>
          <EnterpriseTableHeading>{t("finance.customer")}</EnterpriseTableHeading>
          <EnterpriseTableHeading>{t("finance.project")}</EnterpriseTableHeading>
          <SortableHeading field="status" activeField={sortField} direction={sortDirection} onSort={onSort}>{t("finance.status")}</SortableHeading>
          <SortableHeading field="scheduleImpactDays" activeField={sortField} direction={sortDirection} onSort={onSort}>{t("finance.scheduleImpact")}</SortableHeading>
          <SortableHeading field="totalAmount" activeField={sortField} direction={sortDirection} onSort={onSort} align="right">{t("finance.total")}</SortableHeading>
          <SortableHeading field="requestedDate" activeField={sortField} direction={sortDirection} onSort={onSort}>{t("finance.requestedDate")}</SortableHeading>
          <SortableHeading field="updatedAt" activeField={sortField} direction={sortDirection} onSort={onSort}>{t("finance.updated")}</SortableHeading>
          <EnterpriseTableHeading align="right">{t("finance.actions")}</EnterpriseTableHeading>
        </tr>
      </EnterpriseTableHead>

      <EnterpriseTableBody>
        {items.map((item) => (
          <EnterpriseTableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/change-orders/${item.id}`)}>
            <EnterpriseTableCell className="font-semibold">{item.changeOrderNumber}</EnterpriseTableCell>
            <EnterpriseTableCell>
              <Link data-user-content href={`/change-orders/${item.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]" onClick={(event) => event.stopPropagation()}>
                {item.title}
              </Link>
            </EnterpriseTableCell>
            <EnterpriseTableCell><span data-user-content>{item.customerName}</span></EnterpriseTableCell>
            <EnterpriseTableCell><span data-user-content>{item.projectName}</span></EnterpriseTableCell>
            <EnterpriseTableCell>
              <ChangeOrderStatusBadge status={item.status} />
            </EnterpriseTableCell>
            <EnterpriseTableCell>
              <span className={item.scheduleImpactDays > 0 ? "text-[var(--color-warning-700)]" : item.scheduleImpactDays < 0 ? "text-[var(--color-success-700)]" : "text-[var(--color-text-secondary)]"}>
                {item.scheduleImpactDays > 0 ? "+" : ""}{item.scheduleImpactDays} {t(Math.abs(item.scheduleImpactDays) === 1 ? "finance.day" : "finance.days")}
              </span>
            </EnterpriseTableCell>
            <EnterpriseTableCell align="right" className="font-semibold">{formatUsd(item.totalAmount, localeTag)}</EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{item.requestedDate || t("finance.notSet")}</EnterpriseTableCell>
            <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{new Date(item.updatedAt).toLocaleDateString(localeTag)}</EnterpriseTableCell>
            <EnterpriseTableCell align="right">
              <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                <Link href={`/change-orders/${item.id}`} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                  {t("finance.view")}
                </Link>
                <Link href={`/change-orders/${item.id}/edit`} className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                  {t("finance.edit")}
                </Link>
                {item.archivedAt ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => onRestore(item.id)}>
                    {t("finance.restore")}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" size="sm" onClick={() => onArchive(item.id)} disabled={formatChangeOrderStatusLabel(item.status) === "Void"}>
                    {t("finance.archive")}
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
