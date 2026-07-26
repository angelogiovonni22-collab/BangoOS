"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import {
  formatProjectCurrency,
  formatProjectDate,
  getProjectDisplayName,
  normalizeProjectStatus,
  normalizeProjectType,
  type ProjectRow,
} from "@/lib/projects";
import {
  PROJECT_STATUSES,
  getProjectStatusBadgeClass,
} from "@/lib/projects/statuses";

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "first_name" | "last_name" | "company_name" | "customer_type"
>;

type ProjectListItem = {
  id: string;
  projectNumber: string;
  name: string;
  customerName: string;
  customerId: string | null;
  statusKey: string;
  statusLabel: string;
  typeKey: string;
  typeLabel: string;
  estimatedCost: string;
  estimatedStart: string;
  estimatedEnd: string;
  searchText: string;
};

export default function ProjectsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    let isSubscribed = true;

    const loadProjects = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage);
          setIsLoading(false);
        }

        return;
      }

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }

        return;
      }

      try {
        const [projectsResponse, customersResponse] = await Promise.all([
          client
            .from("projects")
            .select(
              "id, company_id, customer_id, name, project_number, project_type, status, estimated_cost, estimated_start_date, estimated_end_date, created_at",
            )
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
          client
            .from("customers")
            .select("id, first_name, last_name, company_name, customer_type")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
        ]);

        if (projectsResponse.error) {
          if (isSubscribed) {
            setErrorMessage("Unable to load projects right now. Please try again shortly.");
          }

          return;
        }

        if (customersResponse.error) {
          if (isSubscribed) {
            setErrorMessage("Unable to load project customers right now. Please try again shortly.");
          }

          return;
        }

        const customers = (customersResponse.data ?? []) as CustomerSummaryRow[];
        const customerNameMap = new Map(
          customers.map((customer) => [customer.id, getCustomerDisplayName(customer)]),
        );

        const mappedProjects = (projectsResponse.data ?? []).map((row) => {
          const project = row as ProjectRow;
          const status = normalizeProjectStatus(project.status);
          const projectType = normalizeProjectType(project.project_type);
          const customerName = project.customer_id
            ? customerNameMap.get(project.customer_id) || "Not linked"
            : "Not linked";
          const projectNumber = project.project_number?.trim() || "Not provided";
          const searchText = [
            project.name,
            project.project_number || "",
            customerName,
            status.label,
            projectType.label,
          ]
            .join(" ")
            .toLowerCase();

          return {
            id: project.id,
            projectNumber,
            name: getProjectDisplayName(project),
            customerName,
            customerId: project.customer_id,
            statusKey: status.key,
            statusLabel: status.label,
            typeKey: projectType.key,
            typeLabel: projectType.label,
            estimatedCost: formatProjectCurrency(project.estimated_cost),
            estimatedStart: formatProjectDate(project.estimated_start_date),
            estimatedEnd: formatProjectDate(project.estimated_end_date),
            searchText,
          };
        });

        const customerOptionsData = customers.map((customer) => ({
          id: customer.id,
          label: getCustomerDisplayName(customer),
        }));

        if (isSubscribed) {
          setProjects(mappedProjects);
          setCustomerOptions(customerOptionsData);
        }
      } catch (caughtError) {
        console.error("Load projects error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(
            "Something unexpected happened while loading projects. Please try again.",
          );
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadProjects();

    return () => {
      isSubscribed = false;
    };
  }, [supabase]);

  const summary = useMemo(() => {
    const totalProjects = projects.length;
    const inProgressProjects = projects.filter((project) => project.statusKey === "in_progress").length;
    const leadProjects = projects.filter((project) => project.statusKey === "lead").length;
    const completedProjects = projects.filter((project) => project.statusKey === "completed").length;

    return {
      totalProjects,
      inProgressProjects,
      leadProjects,
      completedProjects,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedStatusFilter = statusFilter.toLowerCase();

    return projects.filter((project) => {
      const matchesSearch = !normalizedSearch || project.searchText.includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "All" || project.statusKey === normalizedStatusFilter;
      const matchesCustomer =
        customerFilter === "All" || project.customerId === customerFilter;

      return matchesSearch && matchesStatus && matchesCustomer;
    });
  }, [projects, searchTerm, statusFilter, customerFilter]);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Project Management</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Projects
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600">
            Track active work, leads, and completed projects across your company.
          </p>
        </div>

        <Link
          href="/projects/new"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <span className="mr-2 text-lg leading-none">+</span>
          New Project
        </Link>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Projects" value={String(summary.totalProjects)} />
        <SummaryCard title="In Progress" value={String(summary.inProgressProjects)} />
        <SummaryCard title="Lead" value={String(summary.leadProjects)} />
        <SummaryCard title="Completed" value={String(summary.completedProjects)} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Project Directory</h2>

              <p className="mt-1 text-sm text-slate-500">
                Search, filter, and open any project workspace.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="relative block md:col-span-1">
                <span className="sr-only">Search projects</span>

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search projects..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="sr-only">Filter by status</span>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="All">All statuses</option>
                  {PROJECT_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="sr-only">Filter by customer</span>

                <select
                  value={customerFilter}
                  onChange={(event) => setCustomerFilter(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                >
                  <option value="All">All customers</option>
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        {isLoading ? (
          <ProjectsLoadingState />
        ) : errorMessage ? (
          <ProjectsErrorState message={errorMessage} />
        ) : filteredProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>Project Number</TableHeading>
                  <TableHeading>Project Name</TableHeading>
                  <TableHeading>Customer</TableHeading>
                  <TableHeading>Status</TableHeading>
                  <TableHeading>Project Type</TableHeading>
                  <TableHeading>Estimated Cost</TableHeading>
                  <TableHeading>Estimated Start</TableHeading>
                  <TableHeading>Estimated Completion</TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="cursor-pointer transition hover:bg-slate-50" onClick={() => window.location.assign(`/projects/${project.id}`)}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      <Link href={`/projects/${project.id}`} className="font-semibold text-blue-600 transition hover:text-blue-800" onClick={(event) => event.stopPropagation()}>
                        {project.projectNumber}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link href={`/projects/${project.id}`} className="font-semibold text-slate-950 transition hover:text-blue-700" onClick={(event) => event.stopPropagation()}>
                        {project.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {project.customerName}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <ProjectStatusBadge statusKey={project.statusKey} label={project.statusLabel} />
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {project.typeLabel}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {project.estimatedCost}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {project.estimatedStart}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {project.estimatedEnd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : projects.length === 0 ? (
          <ProjectsEmptyState />
        ) : (
          <ProjectsFilteredEmptyState />
        )}
      </section>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{title}</p>

      <p className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

function TableHeading({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}

function ProjectStatusBadge({ statusKey, label }: { statusKey: string; label: string }) {
  const badgeStyle = getProjectStatusBadgeClass(statusKey);

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${badgeStyle}`}>{label}</span>;
}

function ProjectsLoadingState() {
  return (
    <div className="flex min-h-80 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h3 className="text-xl font-semibold text-slate-950">Loading projects...</h3>

        <p className="mt-2 leading-7 text-slate-500">
          Please wait while we load your project directory.
        </p>
      </div>
    </div>
  );
}

function ProjectsErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-80 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-bold text-rose-600">
          !
        </div>

        <h3 className="mt-5 text-xl font-semibold text-slate-950">
          We couldn&apos;t load projects
        </h3>

        <p className="mt-2 leading-7 text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function ProjectsEmptyState() {
  return (
    <div className="flex min-h-80 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">
          P
        </div>

        <h3 className="mt-5 text-xl font-semibold text-slate-950">No projects yet</h3>

        <p className="mt-2 leading-7 text-slate-500">
          Add your first project to start tracking work, scheduling, and billing.
        </p>

        <Link
          href="/projects/new"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Create Project
        </Link>
      </div>
    </div>
  );
}

function ProjectsFilteredEmptyState() {
  return (
    <div className="flex min-h-80 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-600">
          ?
        </div>

        <h3 className="mt-5 text-xl font-semibold text-slate-950">
          No projects match your filters
        </h3>

        <p className="mt-2 leading-7 text-slate-500">
          Try clearing the search term or changing the status and customer filters.
        </p>
      </div>
    </div>
  );
}

function getCustomerDisplayName(customer: CustomerSummaryRow) {
  const companyName = customer.company_name?.trim() || "";
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) {
    return companyName;
  }

  return fallbackName || companyName || "Unnamed Customer";
}