import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Eye, MoreHorizontal, Pencil } from "lucide-react";
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
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CustomerTable({ items, total, page, pageSize, onPageChange, t }: CustomerTableProps) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = total === 0 ? 0 : Math.min(total, page * pageSize);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <TableContainer
      title="Customer List"
      description={`${total} ${total === 1 ? "customer" : "customers"}`}
    >
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

                if (target.closest("a,button,input,select,textarea")) {
                  return;
                }

                router.push(`/customers/${customer.id}`);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                router.push(`/customers/${customer.id}`);
              }}
            >
              <EnterpriseTableCell>
                <div className="flex items-start gap-3">
                  <CustomerAvatar name={customer.name} />
                  <div className="min-w-0">
                    <Link href={`/customers/${customer.id}`} className="truncate text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">
                      {customer.name}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{customer.city || customer.email}</p>
                  </div>
                </div>
              </EnterpriseTableCell>

              <EnterpriseTableCell>
                <Badge tone={getCustomerTypeTone(customer.typeKey)}>{customer.type}</Badge>
              </EnterpriseTableCell>

              <EnterpriseTableCell>{customer.email}</EnterpriseTableCell>
              <EnterpriseTableCell>{customer.phone}</EnterpriseTableCell>
              <EnterpriseTableCell>{customer.city}</EnterpriseTableCell>

              <EnterpriseTableCell>
                <StatusBadge status={customer.status} />
              </EnterpriseTableCell>

              <EnterpriseTableCell>{formatCreatedDate(customer.createdAt)}</EnterpriseTableCell>

              <EnterpriseTableCell align="right">
                <div className="inline-flex items-center gap-1">
                  <Link href={`/customers/${customer.id}`}>
                    <Button variant="ghost" size="sm" className="transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-surface-subtle)]" aria-label={t("customers.view")}>
                      <Eye size={15} aria-hidden="true" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" className="transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-surface-subtle)]" aria-label={t("customers.editCustomer")}>
                    <Pencil size={15} aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" size="sm" className="transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-surface-subtle)]" aria-label={t("customers.actions.more")}>
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
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("customers.pagination.showing", { from: showingFrom, to: showingTo, total })}
          </p>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={!canPrev}>
              <ChevronLeft size={14} aria-hidden="true" />
              {t("customers.pagination.previous")}
            </Button>
            <span className="inline-flex min-w-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
              {page}
            </span>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={!canNext}>
              {t("customers.pagination.next")}
              <ChevronRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </EnterpriseTableFooter>
    </TableContainer>
  );
}

function formatCreatedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getCustomerTypeTone(typeKey: string): "neutral" | "brand" | "success" | "warning" | "info" {
  const toneMap: Record<string, "neutral" | "brand" | "success" | "warning" | "info"> = {
    commercial: "brand",
    residential: "success",
    government: "info",
    other: "neutral",
  };

  return toneMap[typeKey] || "neutral";
}
