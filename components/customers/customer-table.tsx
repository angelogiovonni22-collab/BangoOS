"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
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
  PortalHost,
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

type OpenMenu = {
  customer: CustomerTableItem;
  left: number;
  top: number;
};

const ACTION_MENU_WIDTH = 208;
const ACTION_MENU_HEIGHT = 268;
const ACTION_MENU_GAP = 8;
const VIEWPORT_PADDING = 12;

function getMenuPosition(rect: DOMRect) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - ACTION_MENU_WIDTH - VIEWPORT_PADDING);
  const left = Math.min(Math.max(VIEWPORT_PADDING, rect.right - ACTION_MENU_WIDTH), maxLeft);
  const belowTop = rect.bottom + ACTION_MENU_GAP;
  const top = belowTop + ACTION_MENU_HEIGHT <= viewportHeight - VIEWPORT_PADDING
    ? belowTop
    : Math.max(VIEWPORT_PADDING, rect.top - ACTION_MENU_HEIGHT - ACTION_MENU_GAP);

  return { left, top };
}

export function CustomerTable({ items, total, page, pageSize, onPageChange, onArchive, onRestore, onDelete, t }: CustomerTableProps) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  useEffect(() => {
    if (!openMenu) return;

    const closeMenu = () => setOpenMenu(null);
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || activeButtonRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMenu();
      activeButtonRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [openMenu]);

  async function runAction(customer: CustomerTableItem, action: "archive" | "restore" | "delete") {
    setOpenMenu(null);
    setBusyId(customer.id);
    try {
      if (action === "archive") await onArchive(customer);
      if (action === "restore") await onRestore(customer);
      if (action === "delete") await onDelete(customer);
    } finally {
      setBusyId(null);
    }
  }

  function toggleMenu(event: ReactMouseEvent<HTMLButtonElement>, customer: CustomerTableItem) {
    event.stopPropagation();
    if (openMenu?.customer.id === customer.id) {
      setOpenMenu(null);
      return;
    }

    activeButtonRef.current = event.currentTarget;
    const position = getMenuPosition(event.currentTarget.getBoundingClientRect());
    setOpenMenu({ customer, ...position });
  }

  return (
    <>
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
                  <div className="inline-flex items-center gap-1">
                    <Link href={`/customers/${customer.id}`} className={getButtonClassName({ variant: "ghost", size: "sm" })}><Eye size={15} aria-hidden="true" /></Link>
                    <Link href={`/customers/${customer.id}?edit=1`} className={getButtonClassName({ variant: "ghost", size: "sm" })}><Pencil size={15} aria-hidden="true" /></Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busyId === customer.id}
                      aria-label={t("customers.actions.more")}
                      aria-haspopup="menu"
                      aria-expanded={openMenu?.customer.id === customer.id}
                      onClick={(event) => toggleMenu(event, customer)}
                    >
                      <MoreHorizontal size={15} aria-hidden="true" />
                    </Button>
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

      {openMenu ? (
        <PortalHost>
          <div
            ref={menuRef}
            role="menu"
            aria-label={`${openMenu.customer.name} actions`}
            className="fixed z-[1000] w-52 overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-white p-1.5 text-left shadow-2xl"
            style={{ left: openMenu.left, top: openMenu.top }}
          >
            <MenuLink href={`/customers/${openMenu.customer.id}`} icon={<Eye size={14} />} onNavigate={() => setOpenMenu(null)}>View Customer</MenuLink>
            <MenuLink href={`/customers/${openMenu.customer.id}?edit=1`} icon={<Pencil size={14} />} onNavigate={() => setOpenMenu(null)}>Edit Customer</MenuLink>
            <MenuLink href={`/estimates/new?customerId=${openMenu.customer.id}`} icon={<FilePlus2 size={14} />} onNavigate={() => setOpenMenu(null)}>Create Estimate</MenuLink>
            <MenuLink href={`/projects/new?customerId=${openMenu.customer.id}`} icon={<FilePlus2 size={14} />} onNavigate={() => setOpenMenu(null)}>Create Project</MenuLink>
            <div className="my-1 border-t border-[var(--color-border-subtle)]" />
            {openMenu.customer.statusKey === "archived" ? (
              <MenuButton icon={<RotateCcw size={14} />} onClick={() => void runAction(openMenu.customer, "restore")}>Restore Customer</MenuButton>
            ) : (
              <MenuButton icon={<Archive size={14} />} onClick={() => void runAction(openMenu.customer, "archive")}>Archive Customer</MenuButton>
            )}
            <MenuButton danger icon={<Trash2 size={14} />} onClick={() => void runAction(openMenu.customer, "delete")}>Delete Customer</MenuButton>
          </div>
        </PortalHost>
      ) : null}
    </>
  );
}

function MenuLink({ href, icon, children, onNavigate }: { href: string; icon: ReactNode; children: ReactNode; onNavigate: () => void }) {
  return <Link href={href} role="menuitem" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{icon}<span>{children}</span></Link>;
}

function MenuButton({ icon, children, onClick, danger = false }: { icon: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-slate-50 ${danger ? "text-red-700" : "text-slate-700"}`}>{icon}<span>{children}</span></button>;
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
