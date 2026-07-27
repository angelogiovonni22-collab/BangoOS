"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";
import {
  formatProjectCurrency,
  formatProjectDate,
  getProjectDisplayName,
  normalizeProjectStatus,
  normalizeProjectType,
  type ProjectRow,
} from "@/lib/projects";
import { getProjectStatusBadgeClass } from "@/lib/projects/statuses";
import { useI18n } from "@/lib/i18n/provider";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

type CustomerDetails = {
  id: string;
  name: string;
  customerTypeLabel: string;
  customerTypeKey: "residential" | "commercial";
  statusLabel: string;
  statusKey: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  createdAt: string;
};

type CustomerProject = {
  id: string;
  name: string;
  projectNumber: string;
  statusLabel: string;
  statusKey: string;
  typeLabel: string;
  estimatedStart: string;
  estimatedEnd: string;
  estimatedCost: string;
};

export default function CustomerDetailsPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id?: string | string[] }>();
  const customerId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const supabase = useMemo(() => createClient(), []);

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [customerProjects, setCustomerProjects] = useState<CustomerProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isSubscribed = true;

    const loadCustomer = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorMessage(t("customers.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      if (!customerId) {
        if (isSubscribed) {
          setErrorMessage(t("customers.errorReadCustomerId"));
          setIsLoading(false);
        }

        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await client.auth.getUser();

        if (userError || !user) {
          if (isSubscribed) {
            setErrorMessage(t("customers.errorViewCustomerLogin"));
          }

          return;
        }

        const { data: company, error: companyError } = await client
          .from("companies")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (companyError) {
          if (isSubscribed) {
            setErrorMessage(t("customers.errorVerifyWorkspace"));
          }

          return;
        }

        if (!company) {
          if (isSubscribed) {
            setErrorMessage(t("customers.errorNoCompanyYet"));
          }

          return;
        }

        const { data: row, error: customerError } = await client
          .from("customers")
          .select(
            "id, company_id, customer_type, first_name, last_name, company_name, email, phone, address_line_1, address_line_2, city, state, postal_code, notes, status, created_at",
          )
          .eq("id", customerId)
          .eq("company_id", company.id)
          .maybeSingle<CustomerRow>();

        if (customerError) {
          if (isSubscribed) {
            setErrorMessage(t("customers.errorLoadCustomer"));
          }

          return;
        }

        if (!row) {
          if (isSubscribed) {
            setNotFound(true);
          }

          return;
        }

        const normalizedCustomerType = normalizeCustomerType(row.customer_type, t);
        const normalizedStatus = normalizeCustomerStatus(row.status, t);

        const nextCustomer: CustomerDetails = {
          id: row.id,
          name: getCustomerName(row, normalizedCustomerType.key, t),
          customerTypeLabel: normalizedCustomerType.label,
          customerTypeKey: normalizedCustomerType.key,
          statusLabel: normalizedStatus.label,
          statusKey: normalizedStatus.key,
          email: row.email?.trim() || "",
          phone: row.phone?.trim() || "",
          address: formatAddress(row),
          notes: row.notes?.trim() || "",
          createdAt: row.created_at,
        };

        if (isSubscribed) {
          setCustomer(nextCustomer);
        }

        setProjectsLoading(true);
        setProjectsError(null);

        const { data: projectRows, error: projectError } = await client
          .from("projects")
          .select(
            "id, company_id, customer_id, name, project_number, project_type, status, estimated_cost, estimated_start_date, estimated_end_date, created_at",
          )
          .eq("company_id", company.id)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });

        if (projectError) {
          if (isSubscribed) {
            setProjectsError(t("customers.errorLoadProjects"));
          }

          return;
        }

        const mappedProjects = (projectRows ?? []).map((row) => {
          const project = row as ProjectRow;
          const status = normalizeProjectStatus(project.status);
          const projectType = normalizeProjectType(project.project_type);
          const localeTag = locale === "es" ? "es-ES" : "en-US";

          return {
            id: project.id,
            name: getProjectDisplayName(project, t("projects.unnamedProject")),
            projectNumber: project.project_number?.trim() || t("customers.notProvided"),
            statusLabel: mapProjectStatus(status.key, t),
            statusKey: status.key,
            typeLabel: mapProjectType(projectType.key, t),
            estimatedStart: formatProjectDate(project.estimated_start_date, localeTag, t("customers.notProvided")),
            estimatedEnd: formatProjectDate(project.estimated_end_date, localeTag, t("customers.notProvided")),
            estimatedCost: formatProjectCurrency(project.estimated_cost, localeTag, t("customers.notProvided")),
          };
        });

        if (isSubscribed) {
          setCustomerProjects(mappedProjects);
        }
      } catch (caughtError) {
        console.error("Load customer error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(t("customers.errorLoadCustomerUnexpected"));
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
          setProjectsLoading(false);
        }
      }
    };

    void loadCustomer();

    return () => {
      isSubscribed = false;
    };
  }, [customerId, locale, supabase, t]);

  if (isLoading) {
    return <CustomerLoadingState />;
  }

  if (errorMessage) {
    return <CustomerErrorState message={errorMessage} />;
  }

  if (notFound || !customer) {
    return <CustomerNotFoundState />;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500">
            <Link href="/customers" className="text-blue-600 transition hover:text-blue-800">
              {t("customers.backToCustomers")}
            </Link>
            <span aria-hidden="true">/</span>
            <span>{t("customers.detailsTitle")}</span>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">{t("customers.pageEyebrow")}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{customer.name}</h1>
            <p className="mt-2 text-slate-600">{t("customers.detailsDescription")}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/customers"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            {t("customers.back")}
          </Link>

          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("customers.comingSoon")}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm opacity-70 transition"
          >
            {t("customers.editCustomer")}
          </button>
        </div>
      </section>

      <section
        aria-label="Customer sections"
        className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <nav className="flex flex-wrap gap-2" aria-label="Customer page sections">
          {customerSections(t).map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                section.id === "overview"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              {section.label}
            </a>
          ))}
        </nav>
      </section>

      <section id="overview" className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">{t("customers.overview")}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("customers.overviewDescription")}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill variant={customer.customerTypeKey} label={customer.customerTypeLabel} />
              <StatusPill variant={customer.statusKey} label={customer.statusLabel} />
            </div>
          </div>
        </div>

        <div className="p-6">
          <dl className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <DetailItem label={t("customers.email")} value={customer.email} />
            <DetailItem label={t("customers.phoneNumber")} value={customer.phone} />
            <DetailItem label={t("customers.customerTypeLabel")} value={customer.customerTypeLabel} />
            <DetailItem label={t("customers.tableStatus")} value={customer.statusLabel} />
            <DetailItem label={t("customers.dateAdded")} value={formatDate(customer.createdAt, locale, t)} />
            <DetailItem label={t("customers.notes")} value={customer.notes} fullWidth />
            <DetailItem label={t("customers.fullAddress")} value={customer.address} fullWidth />
          </dl>
        </div>
      </section>

      {customerSections(t)
        .filter((section) => section.id !== "overview")
        .map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-950">{section.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{t("customers.comingSoon")}</p>
            </div>

            <div className="p-6">
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div>
                  <p className="text-base font-semibold text-slate-800">
                    {t("customers.sectionComingSoon", { section: section.label })}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {t("customers.sectionComingSoonDescription", { section: section.label.toLowerCase() })}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ))}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.projectsTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("customers.projectsDescription")}</p>
        </div>

        <div className="p-6">
          {projectsLoading ? (
            <CustomerProjectsLoadingState />
          ) : projectsError ? (
            <CustomerProjectsErrorState message={projectsError} />
          ) : customerProjects.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {customerProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-950">{project.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {t("customers.projectNumber")} {project.projectNumber}
                      </p>
                    </div>

                    <StatusPill variant={project.statusKey} label={project.statusLabel} />
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <DetailStat label={t("customers.type")} value={project.typeLabel} />
                    <DetailStat label={t("customers.estimatedCost")} value={project.estimatedCost} />
                    <DetailStat label={t("customers.estimatedStart")} value={project.estimatedStart} />
                    <DetailStat label={t("customers.estimatedCompletion")} value={project.estimatedEnd} />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <CustomerProjectsEmptyState />
          )}
        </div>
      </section>
    </div>
  );
}

function customerSections(t: (key: string) => string) {
  return [
    { id: "overview", label: t("customers.overview") },
    { id: "projects", label: t("customers.projects") },
    { id: "estimates", label: t("customers.estimates") },
    { id: "invoices", label: t("customers.invoices") },
    { id: "files", label: t("customers.files") },
    { id: "activity", label: t("customers.activity") },
  ];
}

function CustomerLoadingState() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">C
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">{t("customers.loadingCustomer")}</h1>
        <p className="mt-2 leading-7 text-slate-500">{t("customers.loadingCustomerDescription")}</p>
      </div>
    </div>
  );
}

function CustomerErrorState({ message }: { message: string }) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-bold text-rose-600">!
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">{t("customers.errorCustomerTitle")}</h1>
        <p className="mt-2 leading-7 text-slate-500">{message}</p>
        <Link
          href="/customers"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          {t("customers.backToCustomers")}
        </Link>
      </div>
    </div>
  );
}

function CustomerNotFoundState() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-600">?
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">{t("customers.customerNotFoundTitle")}</h1>
        <p className="mt-2 leading-7 text-slate-500">{t("customers.customerNotFoundDescription")}</p>
        <Link
          href="/customers"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          {t("customers.backToCustomers")}
        </Link>
      </div>
    </div>
  );
}

function CustomerProjectsLoadingState() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div>
        <p className="font-semibold text-slate-800">{t("customers.loadingProjects")}</p>
        <p className="mt-2 text-sm text-slate-500">{t("customers.loadingProjectsDescription")}</p>
      </div>
    </div>
  );
}

function CustomerProjectsErrorState({ message }: { message: string }) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-rose-300 bg-rose-50 p-8 text-center">
      <div>
        <p className="font-semibold text-rose-700">{t("customers.errorProjectsTitle")}</p>
        <p className="mt-2 text-sm text-rose-600">{message}</p>
      </div>
    </div>
  );
}

function CustomerProjectsEmptyState() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div>
        <p className="font-semibold text-slate-800">{t("customers.emptyProjectsTitle")}</p>
        <p className="mt-2 text-sm text-slate-500">{t("customers.emptyProjectsDescription")}</p>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-800">{value}</p>
    </div>
  );
}

function DetailItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className={fullWidth ? "md:col-span-2 xl:col-span-3" : ""}>
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="mt-2 whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800">
        {value.trim() ? value : t("customers.notProvided")}
      </dd>
    </div>
  );
}

function StatusPill({
  variant,
  label,
}: {
  variant: string;
  label: string;
}) {
  const styles: Record<string, string> = {
    residential: "bg-slate-100 text-slate-700 ring-slate-500/20",
    commercial: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
    lead: getProjectStatusBadgeClass("lead"),
    estimating: getProjectStatusBadgeClass("estimating"),
    approved: getProjectStatusBadgeClass("approved"),
    scheduled: getProjectStatusBadgeClass("scheduled"),
    in_progress: getProjectStatusBadgeClass("in_progress"),
    on_hold: getProjectStatusBadgeClass("on_hold"),
    completed: getProjectStatusBadgeClass("completed"),
    cancelled: getProjectStatusBadgeClass("cancelled"),
    active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    inactive: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };

  const badgeStyle = styles[variant] || styles.inactive;

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeStyle}`}>
      {label}
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

function mapProjectStatus(statusKey: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    lead: "customers.statusLead",
    in_progress: "projects.statusInProgress",
    completed: "projects.statusCompleted",
    on_hold: "projects.statusOnHold",
    scheduled: "projects.statusScheduled",
    approved: "projects.statusApproved",
    cancelled: "projects.statusCancelled",
    estimating: "projects.statusEstimating",
  };

  return map[statusKey] ? t(map[statusKey]) : toTitleCase(statusKey.replace(/_/g, " "));
}

function mapProjectType(typeKey: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    residential: "projects.typeResidential",
    commercial: "projects.typeCommercial",
    maintenance: "projects.typeMaintenance",
    renovation: "projects.typeRenovation",
    new_construction: "projects.typeNewConstruction",
    other: "projects.typeOther",
  };

  return map[typeKey] ? t(map[typeKey]) : toTitleCase(typeKey.replace(/_/g, " "));
}

function getCustomerName(row: CustomerRow, customerTypeKey: "residential" | "commercial", t: (key: string) => string) {
  const firstName = row.first_name?.trim() || "";
  const lastName = row.last_name?.trim() || "";
  const companyName = row.company_name?.trim() || "";
  const residentialName = [firstName, lastName].filter(Boolean).join(" ");

  if (customerTypeKey === "commercial") {
    return companyName || residentialName || t("customers.unnamedCustomer");
  }

  return residentialName || companyName || t("customers.unnamedCustomer");
}

function formatAddress(row: CustomerRow) {
  const addressParts = [
    row.address_line_1?.trim() || "",
    row.address_line_2?.trim() || "",
    [row.city?.trim() || "", row.state?.trim() || "", row.postal_code?.trim() || ""]
      .filter(Boolean)
      .join(" "),
  ].filter(Boolean);

  return addressParts.join("\n");
}

function formatDate(value: string, locale: "en" | "es", t: (key: string) => string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return t("customers.notProvided");
  }

  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
