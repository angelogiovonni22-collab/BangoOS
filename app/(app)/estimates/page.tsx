"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  Select,
  SkeletonLoader,
  SummaryCard,
  TableContainer,
  getButtonClassName,
} from "@/components/ui";
import {
  formatEstimateCurrency,
  formatEstimateDate,
  getEstimateNumber,
  normalizeEstimateStatus,
} from "@/lib/estimates";
import {
  ESTIMATE_STATUSES,
  getEstimateStatusBadgeClass,
} from "@/lib/estimates/statuses";

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "first_name" | "last_name" | "company_name" | "customer_type"
>;

type ProjectSummaryRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name"
>;

type EstimateDashboardRow = Pick<
  Database["public"]["Tables"]["estimates"]["Row"],
  | "id"
  | "status"
  | "estimate_number"
  | "customer_id"
  | "project_id"
  | "total_amount"
  | "created_at"
  | "expiration_date"
> & {
  deleted_at?: string | null;
};

type EstimateListItem = {
  id: string;
  statusKey: string;
  statusLabel: string;
  estimateNumber: string;
  customerId: string | null;
  customerName: string;
  projectId: string | null;
  projectName: string;
  totalAmountValue: number;
  totalAmount: string;
  createdAt: string;
  createdAtLabel: string;
  expiresAtLabel: string;
  searchText: string;
};

export default function EstimatesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<EstimateListItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [customerFilter, setCustomerFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");

  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    let isSubscribed = true;

    const loadEstimates = async () => {
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
        const [estimatesResponse, customersResponse, projectsResponse] = await Promise.all([
          client
            .from("estimates")
            .select(
              "id, status, estimate_number, customer_id, project_id, total_amount, created_at, expiration_date, deleted_at",
            )
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
          client
            .from("customers")
            .select("id, first_name, last_name, company_name, customer_type")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
          client
            .from("projects")
            .select("id, name")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
        ]);

        if (estimatesResponse.error) {
          if (isSubscribed) {
            setErrorMessage("Unable to load estimates right now. Please try again shortly.");
          }

          return;
        }

        if (customersResponse.error) {
          if (isSubscribed) {
            setErrorMessage("Unable to load estimate customers right now. Please try again shortly.");
          }

          return;
        }

        if (projectsResponse.error) {
          if (isSubscribed) {
            setErrorMessage("Unable to load estimate projects right now. Please try again shortly.");
          }

          return;
        }

        const customerRows = (customersResponse.data ?? []) as CustomerSummaryRow[];
        const projectRows = (projectsResponse.data ?? []) as ProjectSummaryRow[];
        const estimateRows = (estimatesResponse.data ?? []) as unknown as EstimateDashboardRow[];

        const customerNameMap = new Map(
          customerRows.map((customer) => [customer.id, getCustomerDisplayName(customer)]),
        );

        const projectNameMap = new Map(
          projectRows.map((project) => [project.id, getProjectDisplayName(project.name)]),
        );

        const activeEstimates = estimateRows.filter((estimate) => !estimate.deleted_at);

        const mappedEstimates = activeEstimates.map((estimate) => {
          const status = normalizeEstimateStatus(estimate.status);
          const customerName = estimate.customer_id
            ? customerNameMap.get(estimate.customer_id) || "Not linked"
            : "Not linked";
          const projectName = estimate.project_id
            ? projectNameMap.get(estimate.project_id) || "Not linked"
            : "Not linked";
          const estimateNumber = getEstimateNumber(estimate.estimate_number);
          const totalAmount = formatEstimateCurrency(estimate.total_amount);
          const createdAtLabel = formatEstimateDate(estimate.created_at);
          const expiresAtLabel = formatEstimateDate(estimate.expiration_date);
          const searchText = [
            estimateNumber,
            customerName,
            projectName,
            status.label,
            totalAmount,
          ]
            .join(" ")
            .toLowerCase();

          return {
            id: estimate.id,
            statusKey: status.key,
            statusLabel: status.label,
            estimateNumber,
            customerId: estimate.customer_id,
            customerName,
            projectId: estimate.project_id,
            projectName,
            totalAmountValue:
              typeof estimate.total_amount === "number" ? estimate.total_amount : 0,
            totalAmount,
            createdAt: estimate.created_at,
            createdAtLabel,
            expiresAtLabel,
            searchText,
          };
        });

        if (isSubscribed) {
          setEstimates(mappedEstimates);
          setCustomerOptions(
            customerRows.map((customer) => ({
              id: customer.id,
              label: getCustomerDisplayName(customer),
            })),
          );
          setProjectOptions(
            projectRows.map((project) => ({
              id: project.id,
              label: getProjectDisplayName(project.name),
            })),
          );
        }
      } catch (caughtError) {
        console.error("Load estimates error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(
            "Something unexpected happened while loading estimates. Please try again.",
          );
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadEstimates();

    return () => {
      isSubscribed = false;
    };
  }, [supabase]);

  const summary = useMemo(() => {
    const totalEstimates = estimates.length;
    const draftCount = estimates.filter((estimate) => estimate.statusKey === "draft").length;
    const sentCount = estimates.filter((estimate) => estimate.statusKey === "sent").length;
    const approvedCount = estimates.filter((estimate) => estimate.statusKey === "approved").length;

    const totalEstimateValue = estimates.reduce(
      (sum, estimate) => sum + estimate.totalAmountValue,
      0,
    );

    return {
      totalEstimates,
      draftCount,
      sentCount,
      approvedCount,
      totalEstimateValue: formatEstimateCurrency(totalEstimateValue),
    };
  }, [estimates]);

  const filteredEstimates = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedStatusFilter = statusFilter.toLowerCase();

    return estimates.filter((estimate) => {
      const matchesSearch =
        !normalizedSearch || estimate.searchText.includes(normalizedSearch);
      const matchesStatus =
        statusFilter === "All" || estimate.statusKey === normalizedStatusFilter;
      const matchesCustomer =
        customerFilter === "All" || estimate.customerId === customerFilter;
      const matchesProject =
        projectFilter === "All" || estimate.projectId === projectFilter;

      return matchesSearch && matchesStatus && matchesCustomer && matchesProject;
    });
  }, [estimates, searchTerm, statusFilter, customerFilter, projectFilter]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Estimates"
        description="Track estimate status, value, and customer/project alignment across your company."
        primaryAction={
          <Link href="/estimates/new" className={getButtonClassName({ variant: "primary", size: "lg" })}>
            <span className="text-lg leading-none">+</span>
            <span>Create Estimate</span>
          </Link>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={<span className="text-sm font-bold">Σ</span>}
          label="Total Estimates"
          value={String(summary.totalEstimates)}
        />
        <SummaryCard
          icon={<span className="text-sm font-bold">D</span>}
          label="Draft"
          value={String(summary.draftCount)}
        />
        <SummaryCard
          icon={<span className="text-sm font-bold">S</span>}
          label="Sent"
          value={String(summary.sentCount)}
        />
        <SummaryCard
          icon={<span className="text-sm font-bold">A</span>}
          label="Approved"
          value={String(summary.approvedCount)}
        />
        <SummaryCard
          icon={<span className="text-sm font-bold">$</span>}
          label="Total Estimate Value"
          value={summary.totalEstimateValue}
        />
      </section>

      <TableContainer
        title="Estimate Directory"
        description="Search, filter, and manage estimate records."
        controls={
          <div className="grid gap-3 md:grid-cols-4">
            <SearchInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search estimates..."
            />

            <label className="block">
              <span className="sr-only">Filter by status</span>
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="All">All statuses</option>
                {ESTIMATE_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="sr-only">Filter by customer</span>
              <Select
                value={customerFilter}
                onChange={(event) => setCustomerFilter(event.target.value)}
              >
                <option value="All">All customers</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="sr-only">Filter by project</span>
              <Select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
              >
                <option value="All">All projects</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        }
      >
        {isLoading ? (
          <EstimatesLoadingState />
        ) : errorMessage ? (
          <EstimatesErrorState message={errorMessage} />
        ) : filteredEstimates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeading>Status</TableHeading>
                  <TableHeading>Estimate Number</TableHeading>
                  <TableHeading>Customer</TableHeading>
                  <TableHeading>Project</TableHeading>
                  <TableHeading>Total</TableHeading>
                  <TableHeading>Created</TableHeading>
                  <TableHeading>Expires</TableHeading>
                  <TableHeading align="right">Actions</TableHeading>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredEstimates.map((estimate) => (
                  <tr key={estimate.id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <EstimateStatusBadge
                        statusKey={estimate.statusKey}
                        label={estimate.statusLabel}
                      />
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-slate-950">
                      {estimate.estimateNumber}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {estimate.customerName}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {estimate.projectName}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {estimate.totalAmount}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {estimate.createdAtLabel}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {estimate.expiresAtLabel}
                    </td>

                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/estimates/${estimate.id}`}
                          className={getButtonClassName({ variant: "secondary", size: "sm" })}
                        >
                          View
                        </Link>

                        <Link
                          href={`/estimates/${estimate.id}/edit`}
                          className={getButtonClassName({ variant: "secondary", size: "sm" })}
                        >
                          Edit
                        </Link>

                        <Button type="button" variant="secondary" size="sm">
                          Duplicate
                        </Button>

                        <Button type="button" variant="secondary" size="sm" aria-label="More actions">
                          More
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : estimates.length === 0 ? (
          <EstimatesEmptyState />
        ) : (
          <EstimatesFilteredEmptyState />
        )}
      </TableContainer>
    </div>
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

function EstimateStatusBadge({
  statusKey,
  label,
}: {
  statusKey: string;
  label: string;
}) {
  return <Badge className={getEstimateStatusBadgeClass(statusKey)}>{label}</Badge>;
}

function EstimatesLoadingState() {
  return (
    <div className="p-6">
      <div className="space-y-3">
        <SkeletonLoader className="h-12 w-full" />
        <SkeletonLoader className="h-12 w-full" />
        <SkeletonLoader className="h-12 w-full" />
        <SkeletonLoader className="h-12 w-full" />
      </div>
    </div>
  );
}

function EstimatesErrorState({ message }: { message: string }) {
  return (
    <ErrorState
      title="We couldn&apos;t load estimates"
      description={message}
      compact
    />
  );
}

function EstimatesEmptyState() {
  return (
    <EmptyState
      icon="E"
      title="No estimates yet"
      description="Create your first estimate to begin tracking pricing and approvals."
      compact
      action={
        <Link href="/estimates/new" className={getButtonClassName({ variant: "primary", size: "lg" })}>
          Create Estimate
        </Link>
      }
    />
  );
}

function EstimatesFilteredEmptyState() {
  return (
    <EmptyState
      icon="?"
      title="No estimates match your filters"
      description="Try clearing the search term or changing the status, customer, or project filters."
      compact
    />
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

function getProjectDisplayName(name: string | null) {
  const normalized = name?.trim() || "";

  return normalized || "Unnamed Project";
}
