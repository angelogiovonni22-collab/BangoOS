"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  companyName: string;
  type: "Residential" | "Commercial";
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
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isSubscribed = true;

    const loadCustomers = async () => {
      setIsLoading(true);
      setErrorMessage("");

      if (!supabase) {
        if (isSubscribed) {
          setErrorMessage(
            "Unable to connect right now. Please try again shortly.",
          );
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
            setErrorMessage("You need to be logged in to view customers.");
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
              "Unable to find your company right now. Please try again shortly.",
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

        const { data: rows, error: customersError } = await supabase
          .from("customers")
          .select(
            "id, customer_type, first_name, last_name, company_name, email, phone, address_line_1, address_line_2, city, state, postal_code, status, created_at",
          )
          .eq("company_id", company.id)
          .order("created_at", { ascending: false });

        if (customersError) {
          if (isSubscribed) {
            setErrorMessage(
              "Unable to load customers right now. Please try again shortly.",
            );
          }
          return;
        }

        const mappedCustomers = (rows as CustomerRow[]).map((row) => {
          const customerType = normalizeCustomerType(row.customer_type);
          const firstName = row.first_name?.trim() || "";
          const lastName = row.last_name?.trim() || "";
          const companyName = row.company_name?.trim() || "";
          const fallbackName = [firstName, lastName].filter(Boolean).join(" ");
          const name =
            customerType.key === "commercial" && companyName
              ? companyName
              : fallbackName || companyName || "Unnamed Customer";
          const status = normalizeCustomerStatus(row.status);

          return {
            id: row.id,
            name,
            companyName,
            type: customerType.label,
            typeKey: customerType.key,
            email: row.email?.trim() || "N/A",
            phone: row.phone?.trim() || "N/A",
            location: formatLocation(row.city, row.state, row.postal_code),
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
          setErrorMessage(
            "Something unexpected happened while loading customers. Please try again.",
          );
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
  }, [supabase]);

  const summary = useMemo(() => {
    const activeCustomers = customers.filter(
      (customer) => customer.statusKey === "active",
    ).length;
    const leadCustomers = customers.filter(
      (customer) => customer.statusKey === "lead",
    ).length;
    const commercialCustomers = customers.filter(
      (customer) => customer.typeKey === "commercial",
    ).length;

    return {
      totalCustomers: customers.length,
      activeCustomers,
      leadCustomers,
      commercialCustomers,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedStatusFilter = statusFilter.toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !normalizedSearch ||
        customer.name.toLowerCase().includes(normalizedSearch) ||
        customer.email.toLowerCase().includes(normalizedSearch) ||
        customer.phone.toLowerCase().includes(normalizedSearch) ||
        customer.city.toLowerCase().includes(normalizedSearch) ||
        customer.state.toLowerCase().includes(normalizedSearch) ||
        customer.companyName.toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "All" ||
        customer.statusKey === normalizedStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, searchTerm, statusFilter]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Customer Management</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Customers
          </h1>

          <p className="mt-2 text-slate-600">
            Manage customer contact information, projects, estimates, and
            invoices.
          </p>
        </div>

        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <span className="mr-2 text-lg leading-none">+</span>
          Add Customer
        </Link>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Customers" value={String(summary.totalCustomers)} />
        <SummaryCard title="Active Customers" value={String(summary.activeCustomers)} />
        <SummaryCard title="Leads" value={String(summary.leadCustomers)} />
        <SummaryCard
          title="Commercial Accounts"
          value={String(summary.commercialCustomers)}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Customer Directory
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Search and manage all customer records.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block">
                <span className="sr-only">Search customers</span>

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search customers..."
                  className="w-full min-w-64 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label>
                <span className="sr-only">Filter by status</span>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="All">All statuses</option>
                  <option value="Lead">Leads</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-96 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <h3 className="text-xl font-semibold text-slate-950">
                Loading customers...
              </h3>

              <p className="mt-2 leading-7 text-slate-500">
                Please wait while we load your customer directory.
              </p>
            </div>
          </div>
        ) : errorMessage ? (
          <div className="flex min-h-96 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-bold text-rose-600">
                !
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                We couldn&apos;t load customers
              </h3>

              <p className="mt-2 leading-7 text-slate-500">{errorMessage}</p>
            </div>
          </div>
        ) : filteredCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>Customer</TableHeading>
                  <TableHeading>Type</TableHeading>
                  <TableHeading>Contact</TableHeading>
                  <TableHeading>Location</TableHeading>
                  <TableHeading>Status</TableHeading>
                  <TableHeading align="right">Actions</TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="font-semibold text-slate-950">
                        {customer.name}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        Customer ID: {customer.id}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {customer.type}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm text-slate-700">
                        {customer.email}
                      </div>

                      <div className="mt-1 text-sm text-slate-500">
                        {customer.phone}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {customer.location}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <StatusBadge status={customer.status} statusKey={customer.statusKey} />
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <button
                        type="button"
                        className="text-sm font-semibold text-blue-600 transition hover:text-blue-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex min-h-96 items-center justify-center p-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">
                C
              </div>

              <h3 className="mt-5 text-xl font-semibold text-slate-950">
                No customers yet
              </h3>

              <p className="mt-2 leading-7 text-slate-500">
                Add your first residential or commercial customer to begin
                tracking projects, estimates, invoices, and communication.
              </p>

              <Link
                href="/customers/new"
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <span className="mr-2 text-lg leading-none">+</span>
                Add Your First Customer
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

      <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
        {value}
      </p>
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
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeStyle}`}
    >
      {status}
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

function formatLocation(
  city: string | null,
  state: string | null,
  postalCode: string | null,
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

  return locationParts.join(" ") || "N/A";
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}