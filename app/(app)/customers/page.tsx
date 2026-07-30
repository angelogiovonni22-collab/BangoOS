"use client";

import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CustomerFilters, CustomerMetrics, CustomerTable } from "@/components/customers";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  PageHeader,
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
  category: string;
  contactName: string;
  contactRole: string;
  email: string;
  phone: string;
  status: string;
  statusKey: string;
  assignedToId: string;
  assignedToName: string;
  assignedToRole: string;
};

type CustomerRow = {
  id: string;
  customer_type: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
};

type TeamMemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
};

const PAGE_SIZE = 8;

export default function CustomersPage() {
  const { t } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
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

        const [{ data: rows, error: customersError }, { data: profileRows, error: profilesError }] = await Promise.all([
          client
            .from("customers")
            .select("id, customer_type, first_name, last_name, company_name, email, phone, status, created_by, created_at")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
          client
            .from("profiles")
            .select("id, first_name, last_name, role")
            .eq("company_id", workspace.context.companyId),
        ]);

        if (customersError) {
          if (isSubscribed) {
            setErrorMessage(t("customers.errorLoadCustomers"));
          }
          return;
        }

        if (profilesError) {
          console.warn("Load profiles warning:", profilesError.message);
        }

        const mappedTeamMembers = (profileRows ?? []).map((row) => {
          const profile = row as TeamMemberRow;

          return {
            id: profile.id,
            name: getDisplayName(profile.first_name, profile.last_name, t("common.unknownUser")),
            role: toTitleCase(profile.role?.trim() || t("customers.notProvided")),
          };
        });

        const teamById = new Map(mappedTeamMembers.map((member) => [member.id, member]));

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
          const assignedToId = row.created_by?.trim() || "";
          const assignedTo = assignedToId ? teamById.get(assignedToId) : null;

          return {
            id: row.id,
            name: customerName,
            companyName,
            type: customerType.label,
            typeKey: customerType.key,
            category: companyName || customerType.label,
            contactName,
            contactRole: t("customers.contactRole.primary"),
            email: row.email?.trim() || "-",
            phone: row.phone?.trim() || "-",
            status: customerStatus.label,
            statusKey: customerStatus.key,
            assignedToId,
            assignedToName: assignedTo?.name || t("customers.filters.unassigned"),
            assignedToRole: assignedTo?.role || t("customers.notProvided"),
          };
        });

        if (isSubscribed) {
          setTeamMembers(mappedTeamMembers);
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

  const summary = useMemo(() => {
    const activeCustomers = customers.filter((customer) => customer.statusKey === "active").length;
    const leadCustomers = customers.filter((customer) => customer.statusKey === "lead").length;
    const commercialCustomers = customers.filter((customer) => customer.typeKey === "commercial").length;

    return {
      totalCustomers: customers.length,
      activeCustomers,
      leadCustomers,
      commercialCustomers,
    };
  }, [customers]);

  const typeOptions = useMemo(() => {
    const options = new Map<string, string>([["all", t("customers.filters.allTypes")]]);

    customers.forEach((customer) => {
      options.set(customer.typeKey, customer.type);
    });

    return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
  }, [customers, t]);

  const statusOptions = useMemo(() => {
    const options = new Map<string, string>([["all", t("customers.filters.allStatuses")]]);

    customers.forEach((customer) => {
      options.set(customer.statusKey, customer.status);
    });

    return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
  }, [customers, t]);

  const assignedOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: "all", label: t("customers.filters.allTeamMembers") },
    ];

    teamMembers
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((member) => {
        options.push({ value: member.id, label: member.name });
      });

    const hasUnassigned = customers.some((customer) => !customer.assignedToId);

    if (hasUnassigned) {
      options.push({ value: "unassigned", label: t("customers.filters.unassigned") });
    }

    return options;
  }, [customers, teamMembers, t]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch
        || customer.name.toLowerCase().includes(normalizedSearch)
        || customer.companyName.toLowerCase().includes(normalizedSearch)
        || customer.contactName.toLowerCase().includes(normalizedSearch)
        || customer.email.toLowerCase().includes(normalizedSearch)
        || customer.phone.toLowerCase().includes(normalizedSearch);

      const matchesType = typeFilter === "all" || customer.typeKey === typeFilter;
      const matchesStatus = statusFilter === "all" || customer.statusKey === statusFilter;
      const matchesAssigned =
        assignedFilter === "all"
        || (assignedFilter === "unassigned" ? !customer.assignedToId : customer.assignedToId === assignedFilter);

      return matchesSearch && matchesType && matchesStatus && matchesAssigned;
    });
  }, [assignedFilter, customers, searchTerm, statusFilter, typeFilter]);

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

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleAssignedChange = (value: string) => {
    setAssignedFilter(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        compact
        eyebrow={t("customers.header.eyebrow")}
        title={t("customers.pageTitle")}
        description={t("customers.pageDescription")}
        secondaryActions={(
          <Button variant="secondary" size="md" disabled aria-disabled="true" title={t("customers.comingSoon")}>
            <Upload size={16} aria-hidden="true" />
            {t("customers.actions.import")}
          </Button>
        )}
        primaryAction={(
          <Link href="/customers/new">
            <Button size="md">
              <Plus size={16} aria-hidden="true" />
              {t("customers.addCustomer")}
            </Button>
          </Link>
        )}
      />

      <CustomerFilters
        searchValue={searchTerm}
        typeValue={typeFilter}
        statusValue={statusFilter}
        assignedValue={assignedFilter}
        typeOptions={typeOptions}
        statusOptions={statusOptions}
        assignedOptions={assignedOptions}
        onSearchChange={handleSearchChange}
        onTypeChange={handleTypeChange}
        onStatusChange={handleStatusChange}
        onAssignedChange={handleAssignedChange}
        t={t}
      />

      <CustomerMetrics
        totalCustomers={summary.totalCustomers}
        activeCustomers={summary.activeCustomers}
        leadCustomers={summary.leadCustomers}
        commercialCustomers={summary.commercialCustomers}
        t={t}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
        <div>
          {isLoading ? (
            <CustomersLoadingState />
          ) : errorMessage ? (
            <ErrorState title={t("customers.errorTitle")} description={errorMessage} compact />
          ) : customers.length === 0 ? (
            <EmptyState
              icon="C"
              title={t("customers.emptyTitle")}
              description={t("customers.emptyDescription")}
              compact
              action={
                <Link href="/customers/new">
                  <Button>{t("customers.addFirstCustomer")}</Button>
                </Link>
              }
            />
          ) : filteredCustomers.length === 0 ? (
            <EmptyState
              icon="?"
              title={t("customers.emptyTitle")}
              description={t("customers.filteredEmptyDescription")}
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
        </div>

        <aside>
          <Card as="section" variant="elevated" className="sticky top-24 border-[var(--color-border-subtle)]">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-700)]">{t("common.projectPulse")}</p>
                <h2 className="mt-0.5 text-base font-semibold text-[var(--color-text-primary)]">{t("customers.pulse.title")}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{t("customers.pulse.description")}</p>
              </div>

              <dl className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                <MetricLine label={t("customers.summaryTotal")} value={summary.totalCustomers} />
                <MetricLine label={t("customers.summaryActive")} value={summary.activeCustomers} />
                <MetricLine label={t("customers.summaryLeads")} value={summary.leadCustomers} />
              </dl>

              <p className="text-xs leading-5 text-[var(--color-text-secondary)]">{t("common.projectPulseDescription")}</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}

function CustomersLoadingState() {
  return (
    <div className="space-y-3 rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-card)]">
      <SkeletonLoader className="h-10 w-full" />
      <SkeletonLoader className="h-12 w-full" />
      <SkeletonLoader className="h-12 w-full" />
      <SkeletonLoader className="h-12 w-full" />
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-sm font-semibold text-[var(--color-text-primary)]">{value}</dd>
    </div>
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
  const normalized = status?.trim().toLowerCase() || "inactive";

  if (normalized === "active") {
    return { key: "active", label: t("customers.statusActive") };
  }

  if (normalized === "lead") {
    return { key: "lead", label: t("customers.statusLead") };
  }

  if (normalized === "pending") {
    return { key: "pending", label: t("customers.statusPending") };
  }

  if (normalized === "archived") {
    return { key: "archived", label: t("customers.statusArchived") };
  }

  if (normalized === "inactive") {
    return { key: "inactive", label: t("customers.statusInactive") };
  }

  return { key: normalized, label: toTitleCase(normalized) };
}

function getDisplayName(firstName: string | null, lastName: string | null, fallback: string) {
  const value = [firstName?.trim() || "", lastName?.trim() || ""]
    .filter(Boolean)
    .join(" ");

  return value || fallback;
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
