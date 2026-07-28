"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

type Customer = {
  id: string;
  name: string;
  companyName: string;
  type: string;
  typeKey: "residential" | "commercial";
  email: string;
  phone: string;
  location: string;
  city: string;
  state: string;
  status: string;
  statusKey: string;
};

type CustomerRow = {
  id: string;
  customer_type: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  status: string | null;
  created_at: string;
};

export default function CustomersPage() {
  const router = useRouter();
  const { t } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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
          .select(
            "id, customer_type, first_name, last_name, company_name, email, phone, address_line_1, address_line_2, city, state, postal_code, status, created_at",
          )
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
          const firstName = row.first_name?.trim() || "";
          const lastName = row.last_name?.trim() || "";
          const companyName = row.company_name?.trim() || "";
          const fallbackName = [firstName, lastName].filter(Boolean).join(" ");
          const name =
            customerType.key === "commercial" && companyName
              ? companyName
              : fallbackName || companyName || t("customers.unnamedCustomer");
          const status = normalizeCustomerStatus(row.status, t);

          return {
            id: row.id,
            name,
            companyName,
            type: customerType.label,
            typeKey: customerType.key,
            email: row.email?.trim() || t("customers.na"),
            phone: row.phone?.trim() || t("customers.na"),
            location: formatLocation(row.city, row.state, row.postal_code, t),
            city: row.city?.trim() || "",
            state: row.state?.trim() || "",
            status: status.label,
            statusKey: status.key,
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

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        customer.name.toLowerCase().includes(normalizedSearch) ||
        customer.email.toLowerCase().includes(normalizedSearch) ||
        customer.phone.toLowerCase().includes(normalizedSearch) ||
        customer.city.toLowerCase().includes(normalizedSearch) ||
        customer.state.toLowerCase().includes(normalizedSearch) ||
        customer.companyName.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === "all" || customer.statusKey === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchTerm, statusFilter]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{t("customers.pageEyebrow")}</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t("customers.pageTitle")}</h1>

          <p className="mt-2 text-slate-600">{t("customers.pageDescription")}</p>
        </div>

        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <span className="mr-2 text-lg leading-none">+</span>
          {t("customers.addCustomer")}
        </Link>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title={t("customers.summaryTotal")} value={String(summary.totalCustomers)} />
        <SummaryCard title={t("customers.summaryActive")} value={String(summary.activeCustomers)} />
        <SummaryCard title={t("customers.summaryLeads")} value={String(summary.leadCustomers)} />
        <SummaryCard title={t("customers.summaryCommercial")} value={String(summary.commercialCustomers)} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{t("customers.directoryTitle")}</h2>

              <p className="mt-1 text-sm text-slate-500">{t("customers.directoryDescription")}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block">
                <span className="sr-only">{t("customers.searchPlaceholder")}</span>

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t("customers.searchPlaceholder")}
                  className="w-full min-w-64 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label>
                <span className="sr-only">{t("customers.filterStatus")}</span>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="all">{t("customers.allStatuses")}</option>
                  <option value="lead">{t("customers.statusLead")}</option>
                  <option value="active">{t("customers.statusActive")}</option>
                  <option value="inactive">{t("customers.statusInactive")}</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-96 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <h3 className="text-xl font-semibold text-slate-950">{t("customers.loadingTitle")}</h3>

              <p className="mt-2 leading-7 text-slate-500">{t("customers.loadingDescription")}</p>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex min-h-96 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-bold text-rose-600">!
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-950">{t("customers.errorTitle")}</h3>

              <p className="mt-2 leading-7 text-slate-500">{errorMessage}</p>
            </div>
          </div>
        ) : filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>{t("customers.tableCustomer")}</TableHeading>
                  <TableHeading>{t("customers.tableType")}</TableHeading>
                  <TableHeading>{t("customers.tableContact")}</TableHeading>
                  <TableHeading>{t("customers.tableLocation")}</TableHeading>
                  <TableHeading>{t("customers.tableStatus")}</TableHeading>
                  <TableHeading align="right">{t("customers.tableActions")}</TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer transition hover:bg-slate-50"
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
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-semibold text-slate-950 transition hover:text-blue-700"
                      >
                        {customer.name}
                      </Link>

                      <div className="mt-1 text-sm text-slate-500">
                        {t("customers.customerId")}: {customer.id}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{customer.type}</td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-slate-700">{customer.email}</div>

                      <div className="mt-1 text-sm text-slate-500">{customer.phone}</div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">{customer.location}</td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={customer.status} statusKey={customer.statusKey} />
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="text-sm font-semibold text-blue-600 transition hover:text-blue-800"
                      >
                        {t("customers.view")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">C
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-950">{t("customers.emptyTitle")}</h3>

              <p className="mt-2 leading-7 text-slate-500">{t("customers.emptyDescription")}</p>

              <Link
                href="/customers/new"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <span className="mr-2 text-lg leading-none">+</span>
                {t("customers.addFirstCustomer")}
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>

      <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

function TableHeading({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatusBadge({
  status,
  statusKey,
}: {
  status: string;
  statusKey: string;
}) {
  const styles: Record<string, string> = {
    lead: "bg-amber-50 text-amber-700 ring-amber-600/20",
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };
  const badgeStyle = styles[statusKey] || styles.inactive;

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeStyle}`}>
      {status}
    </span>
  );
}

function normalizeCustomerType(customerType: string | null, t: (key: string) => string) {
  const normalized = customerType?.trim().toLowerCase();

  if (normalized === "commercial") {
    return { key: "commercial" as const, label: t("customers.typeCommercial") };
  }

  return { key: "residential" as const, label: t("customers.typeResidential") };
}

function normalizeCustomerStatus(status: string | null, t: (key: string) => string) {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "active") {
    return { key: "active", label: t("customers.statusActive") };
  }

  if (normalized === "lead") {
    return { key: "lead", label: t("customers.statusLead") };
  }

  if (normalized === "inactive") {
    return { key: "inactive", label: t("customers.statusInactive") };
  }

  return {
    key: normalized || "inactive",
    label: toTitleCase(normalized || "inactive"),
  };
}

function formatLocation(
  city: string | null,
  state: string | null,
  postalCode: string | null,
  t: (key: string) => string,
) {
  const normalizedCity = city?.trim() || "";
  const normalizedState = state?.trim() || "";
  const normalizedPostalCode = postalCode?.trim() || "";
  const locationParts: string[] = [];

  if (normalizedCity && normalizedState) {
    locationParts.push(`${normalizedCity}, ${normalizedState}`);
  } else if (normalizedCity) {
    locationParts.push(normalizedCity);
  } else if (normalizedState) {
    locationParts.push(normalizedState);
  }

  if (normalizedPostalCode) {
    locationParts.push(normalizedPostalCode);
  }

  return locationParts.join(" ") || t("customers.na");
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
