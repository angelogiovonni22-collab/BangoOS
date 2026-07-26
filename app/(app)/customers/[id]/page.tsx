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

      if (!supabase) {
        if (isSubscribed) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }

        return;
      }

      if (!customerId) {
        if (isSubscribed) {
          setErrorMessage("We could not read the customer ID from this link.");
          setIsLoading(false);
        }

        return;
      }

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          if (isSubscribed) {
            setErrorMessage("You need to be logged in to view customer details.");
          }

          return;
        }

        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (companyError) {
          if (isSubscribed) {
            setErrorMessage(
              "Unable to verify your workspace right now. Please try again shortly.",
            );
          }

          return;
        }

        if (!company) {
          if (isSubscribed) {
            setErrorMessage("No company was found for your account yet.");
          }

          return;
        }

        const { data: row, error: customerError } = await supabase
          .from("customers")
          .select(
            "id, company_id, customer_type, first_name, last_name, company_name, email, phone, address_line_1, address_line_2, city, state, postal_code, notes, status, created_at",
          )
          .eq("id", customerId)
          .eq("company_id", company.id)
          .maybeSingle<CustomerRow>();

        if (customerError) {
          if (isSubscribed) {
            setErrorMessage(
              "Unable to load this customer right now. Please try again shortly.",
            );
          }

          return;
        }

        if (!row) {
          if (isSubscribed) {
            setNotFound(true);
          }

          return;
        }

        const normalizedCustomerType = normalizeCustomerType(row.customer_type);
        const normalizedStatus = normalizeCustomerStatus(row.status);

        const nextCustomer: CustomerDetails = {
          id: row.id,
          name: getCustomerName(row, normalizedCustomerType.key),
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

        const { data: projectRows, error: projectError } = await supabase
          .from("projects")
          .select(
            "id, company_id, customer_id, name, project_number, project_type, status, estimated_cost, estimated_start_date, estimated_end_date, created_at",
          )
          .eq("company_id", company.id)
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });

        if (projectError) {
          if (isSubscribed) {
            setProjectsError("Unable to load projects right now. Please try again shortly.");
          }

          return;
        }

        const mappedProjects = (projectRows ?? []).map((row) => {
          const project = row as ProjectRow;
          const status = normalizeProjectStatus(project.status);
          const projectType = normalizeProjectType(project.project_type);

          return {
            id: project.id,
            name: getProjectDisplayName(project),
            projectNumber: project.project_number?.trim() || "Not provided",
            statusLabel: status.label,
            statusKey: status.key,
            typeLabel: projectType.label,
            estimatedStart: formatProjectDate(project.estimated_start_date),
            estimatedEnd: formatProjectDate(project.estimated_end_date),
            estimatedCost: formatProjectCurrency(project.estimated_cost),
          };
        });

        if (isSubscribed) {
          setCustomerProjects(mappedProjects);
        }
      } catch (caughtError) {
        console.error("Load customer error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(
            "Something unexpected happened while loading this customer. Please try again.",
          );
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
  }, [customerId, supabase]);

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
              Back to Customers
            </Link>
            <span aria-hidden="true">/</span>
            <span>Customer Details</span>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500">Customer Management</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {customer.name}
            </h1>
            <p className="mt-2 text-slate-600">
              View contact information, records, and upcoming work for this customer.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/customers"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back
          </Link>

          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Coming soon"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm opacity-70 transition"
          >
            Edit Customer
          </button>
        </div>
      </section>

      <section
        aria-label="Customer sections"
        className="rounded-3xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <nav className="flex flex-wrap gap-2" aria-label="Customer page sections">
          {customerSections.map((section) => (
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
              <h2 className="text-lg font-semibold text-slate-950">Overview</h2>
              <p className="mt-1 text-sm text-slate-500">
                Customer contact details and record information.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusPill variant={customer.customerTypeKey} label={customer.customerTypeLabel} />
              <StatusPill variant={customer.statusKey} label={customer.statusLabel} />
            </div>
          </div>
        </div>

        <div className="p-6">
          <dl className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <DetailItem label="Email" value={customer.email} />
            <DetailItem label="Phone" value={customer.phone} />
            <DetailItem label="Customer Type" value={customer.customerTypeLabel} />
            <DetailItem label="Status" value={customer.statusLabel} />
            <DetailItem label="Date Added" value={formatDate(customer.createdAt)} />
            <DetailItem label="Notes" value={customer.notes} fullWidth />
            <DetailItem label="Full Address" value={customer.address} fullWidth />
          </dl>
        </div>
      </section>

      {customerSections
        .filter((section) => section.id !== "overview")
        .map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-950">{section.label}</h2>
              <p className="mt-1 text-sm text-slate-500">Coming soon</p>
            </div>

            <div className="p-6">
              <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <div>
                  <p className="text-base font-semibold text-slate-800">
                    {section.label} coming soon
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    This section will show customer {section.label.toLowerCase()} once it is connected.
                  </p>
                </div>
              </div>
            </div>
          </section>
        ))}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-950">Projects</h2>
          <p className="mt-1 text-sm text-slate-500">
            Every project associated with this customer.
          </p>
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
                        Project #{project.projectNumber}
                      </p>
                    </div>

                    <StatusPill variant={project.statusKey} label={project.statusLabel} />
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                    <DetailStat label="Type" value={project.typeLabel} />
                    <DetailStat label="Estimated Cost" value={project.estimatedCost} />
                    <DetailStat label="Estimated Start" value={project.estimatedStart} />
                    <DetailStat label="Estimated Completion" value={project.estimatedEnd} />
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

const customerSections = [
  { id: "overview", label: "Overview" },
  { id: "projects", label: "Projects" },
  { id: "estimates", label: "Estimates" },
  { id: "invoices", label: "Invoices" },
  { id: "files", label: "Files" },
  { id: "activity", label: "Activity" },
];

function CustomerLoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">
          C
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">Loading customer...</h1>
        <p className="mt-2 leading-7 text-slate-500">
          Please wait while we load this customer record.
        </p>
      </div>
    </div>
  );
}

function CustomerErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-bold text-rose-600">
          !
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">
          We could not load this customer
        </h1>
        <p className="mt-2 leading-7 text-slate-500">{message}</p>
        <Link
          href="/customers"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Back to Customers
        </Link>
      </div>
    </div>
  );
}

function CustomerNotFoundState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-600">
          ?
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">Customer not found</h1>
        <p className="mt-2 leading-7 text-slate-500">
          This customer may have been removed or may belong to a different company.
        </p>
        <Link
          href="/customers"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Back to Customers
        </Link>
      </div>
    </div>
  );
}

function CustomerProjectsLoadingState() {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div>
        <p className="font-semibold text-slate-800">Loading projects...</p>
        <p className="mt-2 text-sm text-slate-500">Please wait while we load related projects.</p>
      </div>
    </div>
  );
}

function CustomerProjectsErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-rose-300 bg-rose-50 p-8 text-center">
      <div>
        <p className="font-semibold text-rose-700">We could not load projects</p>
        <p className="mt-2 text-sm text-rose-600">{message}</p>
      </div>
    </div>
  );
}

function CustomerProjectsEmptyState() {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div>
        <p className="font-semibold text-slate-800">No projects yet.</p>
        <p className="mt-2 text-sm text-slate-500">
          Projects for this customer will appear here once they are created.
        </p>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
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
  return (
    <div className={fullWidth ? "md:col-span-2 xl:col-span-3" : ""}>
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="mt-2 whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-800">
        {value.trim() ? value : "Not provided"}
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
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeStyle}`}
    >
      {label}
    </span>
  );
}

function normalizeCustomerType(customerType: string | null) {
  const normalized = customerType?.trim().toLowerCase();

  if (normalized === "commercial") {
    return { key: "commercial" as const, label: "Commercial" as const };
  }

  return { key: "residential" as const, label: "Residential" as const };
}

function normalizeCustomerStatus(status: string | null) {
  const normalized = status?.trim().toLowerCase();

  if (normalized === "active") {
    return { key: "active", label: "Active" };
  }

  if (normalized === "lead") {
    return { key: "lead", label: "Lead" };
  }

  if (normalized === "inactive") {
    return { key: "inactive", label: "Inactive" };
  }

  return {
    key: normalized || "inactive",
    label: toTitleCase(normalized || "inactive"),
  };
}

function getCustomerName(row: CustomerRow, customerTypeKey: "residential" | "commercial") {
  const firstName = row.first_name?.trim() || "";
  const lastName = row.last_name?.trim() || "";
  const companyName = row.company_name?.trim() || "";
  const residentialName = [firstName, lastName].filter(Boolean).join(" ");

  if (customerTypeKey === "commercial") {
    return companyName || residentialName || "Unnamed Customer";
  }

  return residentialName || companyName || "Unnamed Customer";
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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not provided";
  }

  return new Intl.DateTimeFormat("en-US", {
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