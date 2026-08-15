"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Archive, ChevronLeft, ChevronRight, Eye, FilePlus2, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  EnterpriseTable,
  EnterpriseTableBody,
  EnterpriseTableCell,
  EnterpriseTableFooter,
  EnterpriseTableHead,
  EnterpriseTableHeading,
  EnterpriseTableRow,
  StatusBadge,
  TableContainer,
} from "@/components/ui";
import { CustomerAvatar } from "./customer-avatar";

type CustomerTableItem = {
  id: string;
  name: string;
  companyName: string;
  type: string;
  typeKey: string;
  email: string;
  phone: string;
  city: string;
  status: string;
  statusKey: string;
  createdAt: string;
};

type CustomerTableProps = {
  items: CustomerTableItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onArchive: (customer: CustomerTableItem) => Promise<void>;
  onRestore: (customer: CustomerTableItem) => Promise<void>;
  onDelete: (customer: CustomerTableItem) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CustomerTable({ items, total, page, pageSize, onPageChange, onArchive, onRestore, onDelete, t }: CustomerTableProps) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  async function runAction(customer: CustomerTableItem, action: "archive" | "restore" | "delete") {
    setOpenMenuId(null);
    setBusyId(customer.id);
    try {
      if (action === "archive") await onArchive(customer);
      if (action === "restore") await onRestore(customer);
      if (action === "delete") await onDelete(customer);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <TableContainer title="Customer List" description={`${total} ${total === 1 ? "customer" : "customers"}`}>
      <EnterpriseTable ariaLabel={t("customers.list.title")}>
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTableHeading>{t("customers.tableCustomer")}</EnterpriseTableHeading>
            <EnterpriseTableHeading>{t("customers.tableType")}</EnterpriseTableHeading>
            <EnterpriseTableHeading>{t("customers.email")}</EnterpriseTableHeading>
            <EnterpriseTableHeading>{t("customers.phoneNumber")}</EnterpriseTableHeading>
            <EnterpriseTableHeading>City</EnterpriseTableHeading>
            <EnterpriseTableHeading>{t("customers.tableStatus")}</EnterpriseTableHeading>
            <EnterpriseTableHeading>Created</EnterpriseTableHeading>
            <EnterpriseTableHeading align="right">{t("customers.tableActions")}</EnterpriseTableHeading>
          </tr>
        </EnterpriseTableHead>

        <EnterpriseTableBody>
          {items.map((customer) => (
            <EnterpriseTableRow
              key={customer.id}
              className="cursor-pointer transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-surface-subtle)]/80 hover:shadow-[0_10px_24px_-20px_rgba(15,23,42,0.28)]"
              role="link"
              tabIndex={0}
              aria-label={`${t("customers.view")} ${customer.name}`}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("a,button,input,select,textarea")) return;
                router.push(`/customers/${customer.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                router.push(`/customers/${customer.id}`);
              }}
            >
              <EnterpriseTableCell>
                <div className="flex items-start gap-3">
                  <CustomerAvatar name={customer.name} />
                  <div className="min-w-0">
                    <Link href={`/customers/${customer.id}`} className="truncate text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">{customer.name}</Link>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{customer.city || customer.email}</p>
                  </div>
                </div>
              </EnterpriseTableCell>
              <EnterpriseTableCell><Badge tone={getCustomerTypeTone(customer.typeKey)}>{customer.type}</Badge></EnterpriseTableCell>
              <EnterpriseTableCell>{customer.email}</EnterpriseTableCell>
              <EnterpriseTableCell>{customer.phone}</EnterpriseTableCell>
              <EnterpriseTableCell>{customer.city}</EnterpriseTableCell>
              <EnterpriseTableCell><StatusBadge status={customer.status} /></EnterpriseTableCell>
              <EnterpriseTableCell>{formatCreatedDate(customer.createdAt)}</EnterpriseTableCell>
              <EnterpriseTableCell align="right">
                <div className="relative inline-flex items-center gap-1">
                  <Link href={`/customers/${customer.id}`}><Button variant="ghost" size="sm" aria-label={t("customers.view")}><Eye size={15} aria-hidden="true" /></Button></Link>
                  <Link href={`/customers/${customer.id}?edit=1`}><Button variant="ghost" size="sm" aria-label={t("customers.editCustomer")}><Pencil size={15} aria-hidden="true" /></Button></Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === customer.id}
                    aria-label={t("customers.actions.more")}
                    aria-expanded={openMenuId === customer.id}
                    onClick={() => setOpenMenuId((current) => current === customer.id ? null : customer.id)}
                  >
                    <MoreHorizontal size={15} aria-hidden="true" />
                  </Button>
                  {openMenuId === customer.id ? (
                    <div className="absolute right-0 top-9 z-50 w-52 overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-white p-1.5 text-left shadow-xl" onClick={(event) => event.stopPropagation()}>
                      <MenuLink href={`/customers/${customer.id}`} icon={<Eye size={14} />}>View Customer</MenuLink>
                      <MenuLink href={`/customers/${customer.id}?edit=1`} icon={<Pencil size={14} />}>Edit Customer</MenuLink>
                      <MenuLink href={`/estimates/new?customerId=${customer.id}`} icon={<FilePlus2 size={14} />}>Create Estimate</MenuLink>
                      <MenuLink href={`/projects/new?customerId=${customer.id}`} icon={<FilePlus2 size={14} />}>Create Project</MenuLink>
                      <div className="my-1 border-t border-[var(--color-border-subtle)]" />
                      {customer.statusKey === "archived" ? (
                        <MenuButton icon={<RotateCcw size={14} />} onClick={() => void runAction(customer, "restore")}>Restore Customer</MenuButton>
                      ) : (
                        <MenuButton icon={<Archive size={14} />} onClick={() => void runAction(customer, "archive")}>Archive Customer</MenuButton>
                      )}
                      <MenuButton danger icon={<Trash2 size={14} />} onClick={() => void runAction(customer, "delete")}>Delete Customer</MenuButton>
                    </div>
                  ) : null}
                </div>
              </EnterpriseTableCell>
            </EnterpriseTableRow>
          ))}
        </EnterpriseTableBody>
      </EnterpriseTable>

      <EnterpriseTableFooter>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--color-text-secondary)]">{t("customers.pagination.showing", { from: showingFrom, to: showingTo, total })}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={!canPrev}><ChevronLeft size={14} aria-hidden="true" />{t("customers.pagination.previous")}</Button>
            <span className="inline-flex min-w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]">{page}</span>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={!canNext}>{t("customers.pagination.next")}<ChevronRight size={14} aria-hidden="true" /></Button>
          </div>
        </div>
      </EnterpriseTableFooter>
    </TableContainer>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return <Link href={href} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{icon}<span>{children}</span></Link>;
}

function MenuButton({ icon, children, onClick, danger = false }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 ${danger ? "text-red-700" : "text-slate-700"}`}>{icon}<span>{children}</span></button>;
}

function formatCreatedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function getCustomerTypeTone(typeKey: string): "neutral" | "brand" | "success" | "warning" | "info" {
  const toneMap: Record<string, "neutral" | "brand" | "success" | "warning" | "info"> = { commercial: "brand", residential: "success", government: "info", other: "neutral" };
  return toneMap[typeKey] || "neutral";
}
