"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CustomerTable } from "@/components/customers";
import {
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  SkeletonLoader,
} from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type Customer = {
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

type CustomerRow = {
  id: string;
  customer_type: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string | null;
  created_at: string;
};

const PAGE_SIZE = 8;

export default function CustomersPage() {
  const { t } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [chipFilter, setChipFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const resolveWorkspaceError = useCallback((errorCode: string | null, fallback: string | null) => {
    if (errorCode === "unauthenticated") {
      return t("customers.errorViewLogin");
    }

    if (errorCode === "profile_missing") {
      return t("customers.errorProfileMissing");
    }

    if (errorCode === "company_missing") {
      return t("customers.errorNoCompanyYet");
    }

    if (errorCode === "supabase_unavailable") {
      return t("customers.errorConnect");
    }

    return fallback || t("customers.errorLoadUnexpected");
  }, [t]);

  useEffect(() => {
    let isSubscribed = true;

    const loadCustomers = async () => {
      setIsLoading(true);
      setErrorMessage("");

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorMessage(t("customers.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(client);

        if (workspace.errorMessage || !workspace.context) {
          if (isSubscribed) {
            setErrorMessage(resolveWorkspaceError(workspace.errorCode, workspace.errorMessage));
          }
          return;
        }

        const { data: rows, error: customersError } = await client
          .from("customers")
          .select("id, customer_type, first_name, last_name, company_name, email, phone, city, status, created_at")
          .eq("company_id", workspace.context.companyId)
          .order("created_at", { ascending: false });

        if (customersError) {
          if (isSubscribed) {
            setErrorMessage(t("customers.errorLoadCustomers"));
          }
          return;
        }

        const mappedCustomers = (rows as CustomerRow[]).map((row) => {
          const customerType = normalizeCustomerType(row.customer_type, t);
          const customerStatus = normalizeCustomerStatus(row.status, t);
          const firstName = row.first_name?.trim() || "";
          const lastName = row.last_name?.trim() || "";
          const companyName = row.company_name?.trim() || "";
          const contactName = [firstName, lastName].filter(Boolean).join(" ") || t("customers.notProvided");
          const customerName =
            customerType.key === "commercial" && companyName
              ? companyName
              : contactName === t("customers.notProvided")
                ? companyName || t("customers.unnamedCustomer")
                : contactName;

          return {
            id: row.id,
            name: customerName,
            companyName,
            type: customerType.label,
            typeKey: customerType.key,
            email: row.email?.trim() || "-",
            phone: row.phone?.trim() || "-",
            city: row.city?.trim() || "-",
            status: customerStatus.label,
            statusKey: customerStatus.key,
            createdAt: row.created_at,
          };
        });

        if (isSubscribed) {
          setCustomers(mappedCustomers);
        }
      } catch (caughtError) {
        console.error("Load customers error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(t("customers.errorLoadUnexpected"));
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadCustomers();

    return () => {
      isSubscribed = false;
    };
  }, [resolveWorkspaceError, supabase, t]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch
        || customer.name.toLowerCase().includes(normalizedSearch)
        || customer.email.toLowerCase().includes(normalizedSearch)
        || customer.phone.toLowerCase().includes(normalizedSearch);

      if (chipFilter === "residential" || chipFilter === "commercial") {
        return matchesSearch && customer.typeKey === chipFilter;
      }

      if (chipFilter === "active" || chipFilter === "archived") {
        return matchesSearch && customer.statusKey === chipFilter;
      }

      return matchesSearch;
    });
  }, [chipFilter, customers, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;

    return filteredCustomers.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredCustomers]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleFilterChipClick = (value: string) => {
    setChipFilter(value);
    setPage(1);
  };

  const filterChips = [
    { key: "all", label: "All" },
    { key: "residential", label: "Residential" },
    { key: "commercial", label: "Commercial" },
    { key: "active", label: "Active" },
    { key: "archived", label: "Archived" },
  ];

  const kpis = useMemo(() => {
    const now = new Date();
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter((customer) => customer.statusKey === "active").length;
    const newThisMonth = customers.filter((customer) => {
      const created = new Date(customer.createdAt);

      return !Number.isNaN(created.getTime())
        && created.getMonth() === now.getMonth()
        && created.getFullYear() === now.getFullYear();
    }).length;

    return {
      totalCustomers,
      activeCustomers,
      newThisMonth,
      lifetimeRevenue: "Coming Soon",
    };
  }, [customers]);

  return (
    <div className="space-y-6">
      <PageHeader
        compact
        title="Customers"
        description="Manage residential, commercial, and property management customers."
        primaryAction={(
          <Link href="/customers/new">
            <Button
              size="md"
              className="h-11 rounded-[var(--radius-lg)] px-5 shadow-[0_10px_24px_-14px_rgba(37,99,235,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-14px_rgba(37,99,235,0.85)]"
            >
              <Plus size={16} aria-hidden="true" />
              New Customer
            </Button>
          </Link>
        )}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Customers" value={kpis.totalCustomers.toLocaleString()} />
        <KpiCard label="Active Customers" value={kpis.activeCustomers.toLocaleString()} />
        <KpiCard label="New This Month" value={kpis.newThisMonth.toLocaleString()} />
        <KpiCard label="Lifetime Revenue" value={kpis.lifetimeRevenue} />
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-3 shadow-[var(--shadow-small)] sm:px-4 sm:py-3.5">
        <div className="space-y-3">
          <SearchInput
            value={searchTerm}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search customers by name, email, or phone"
            aria-label="Search customers"
            className="h-10 rounded-[var(--radius-lg)] transition-all duration-200 focus-visible:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
          />

          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => {
              const isActive = chipFilter === chip.key;

              return (
                <Button
                  key={chip.key}
                  type="button"
                  size="sm"
                  variant={isActive ? "primary" : "outline"}
                  className="h-8 px-3.5 text-xs transition-all duration-200 hover:-translate-y-px"
                  onClick={() => handleFilterChipClick(chip.key)}
                >
                  {chip.label}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <section>
          {isLoading ? (
            <CustomersLoadingState />
          ) : errorMessage ? (
            <ErrorState title={t("customers.errorTitle")} description={errorMessage} compact />
          ) : customers.length === 0 ? (
            <EmptyState
              icon="C"
              title="No customers yet"
              description="Create your first customer to start managing your account relationships."
              compact
              action={
                <Link href="/customers/new">
                  <Button>New Customer</Button>
                </Link>
              }
            />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState
              icon="?"
              title="No customers match this filter"
              description="Try a different filter or search term."
              compact
            />
          ) : (
            <CustomerTable
              items={pagedCustomers}
              total={filteredCustomers.length}
              page={currentPage}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              t={t}
            />
          )}
      </section>
    </div>
  );
}

function CustomersLoadingState() {
  return (
    <div className="space-y-3 rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
      <SkeletonLoader className="h-10 w-full" />
      <SkeletonLoader className="h-12 w-full" />
      <SkeletonLoader className="h-12 w-full" />
      <SkeletonLoader className="h-12 w-full" />
      <SkeletonLoader className="h-12 w-full" />
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 py-3.5 shadow-[var(--shadow-small)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">{value}</p>
    </article>
  );
}

function normalizeCustomerType(customerType: string | null, t: (key: string) => string) {
  const normalized = customerType?.trim().toLowerCase() || "other";

  if (normalized === "commercial") {
    return { key: "commercial", label: t("customers.typeCommercial") };
  }

  if (normalized === "residential") {
    return { key: "residential", label: t("customers.typeResidential") };
  }

  if (normalized === "government") {
    return { key: "government", label: t("customers.typeGovernment") };
  }

  return { key: "other", label: t("customers.typeOther") };
}

function normalizeCustomerStatus(status: string | null, t: (key: string) => string) {
  const normalized = status?.trim().toLowerCase() || "archived";

  if (normalized === "active") {
    return { key: "active", label: t("customers.statusActive") };
  }

  if (normalized === "archived" || normalized === "inactive") {
    return { key: "archived", label: t("customers.statusArchived") };
  }

  if (normalized === "lead" || normalized === "pending") {
    return { key: normalized, label: toTitleCase(normalized) };
  }

  return { key: normalized, label: toTitleCase(normalized.replace(/_/g, " ")) };
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
