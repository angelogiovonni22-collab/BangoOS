"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  SectionHeader,
  Select,
  SkeletonLoader,
  SummaryCard,
  TableContainer,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import {
  formatProjectDate,
  getProjectDisplayName,
  normalizeProjectStatus,
  type ProjectRow,
} from "@/lib/projects";
import { getProjectStatusBadgeClass, PROJECT_STATUSES } from "@/lib/projects/statuses";
import { useI18n } from "@/lib/i18n/provider";

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "first_name" | "last_name" | "company_name" | "customer_type"
>;

type TaskProgressRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "project_id" | "status" | "completion_percentage"
>;

type SortKey = "name" | "customer" | "start_date" | "progress" | "status";

type ProjectListItem = {
  id: string;
  name: string;
  customerName: string;
  customerId: string | null;
  startDate: string;
  startDateRaw: string | null;
  progress: number;
  statusKey: string;
  searchText: string;
};

export default function ProjectsPage() {
  const { t, locale } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    let isSubscribed = true;

    const loadProjects = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage || t("projects.errorLoadWorkspace"));
          setIsLoading(false);
        }

        return;
      }

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorMessage(t("projects.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      try {
        const [projectsResponse, customersResponse, tasksResponse] = await Promise.all([
          client
            .from("projects")
            .select("id, customer_id, name, status, estimated_start_date")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
          client
            .from("customers")
            .select("id, first_name, last_name, company_name, customer_type")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
          client
            .from("tasks")
            .select("project_id, status, completion_percentage")
            .eq("company_id", workspace.context.companyId),
        ]);

        if (projectsResponse.error) {
          if (isSubscribed) {
            setErrorMessage(t("projects.errorLoadProjects"));
          }

          return;
        }

        if (customersResponse.error) {
          if (isSubscribed) {
            setErrorMessage(t("projects.errorLoadCustomers"));
          }

          return;
        }

        if (tasksResponse.error) {
          if (isSubscribed) {
            setErrorMessage(t("projects.errorLoadProjectProgress"));
          }

          return;
        }

        const customerRows = (customersResponse.data ?? []) as CustomerSummaryRow[];
        const taskRows = (tasksResponse.data ?? []) as TaskProgressRow[];
        const customerNameMap = new Map(
          customerRows.map((row) => [row.id, getCustomerDisplayName(row, t("customers.unnamedCustomer"))]),
        );
        const progressByProjectId = buildProjectProgressMap(taskRows);
        const localeTag = locale === "es" ? "es-ES" : "en-US";

        const mappedProjects = (projectsResponse.data ?? []).map((row) => {
          const project = row as Pick<ProjectRow, "id" | "customer_id" | "name" | "status" | "estimated_start_date">;
          const normalizedStatus = normalizeProjectStatus(project.status);
          const customerName = project.customer_id
            ? customerNameMap.get(project.customer_id) || t("projects.notLinked")
            : t("projects.notLinked");
          const statusLabel = getProjectStatusLabel(normalizedStatus.key, t);

          return {
            id: project.id,
            name: getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject")),
            customerName,
            customerId: project.customer_id,
            startDate: formatProjectDate(project.estimated_start_date, localeTag, t("projects.notProvided")),
            startDateRaw: project.estimated_start_date,
            progress: progressByProjectId[project.id] ?? 0,
            statusKey: normalizedStatus.key,
            searchText: [
              project.name,
              customerName,
              statusLabel,
              formatProjectDate(project.estimated_start_date, localeTag, t("projects.notProvided")),
            ]
              .join(" ")
              .toLowerCase(),
          };
        });

        if (isSubscribed) {
          setProjects(mappedProjects);
          setCustomerOptions(
            customerRows.map((row) => ({
              id: row.id,
              label: getCustomerDisplayName(row, t("customers.unnamedCustomer")),
            })),
          );
        }
      } catch (caughtError) {
        console.error("Load projects error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(t("projects.errorUnexpectedLoad"));
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
  }, [locale, supabase, t]);

  const filteredAndSortedProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return projects
      .filter((project) => {
        const matchesSearch = !normalizedSearch || project.searchText.includes(normalizedSearch);
        const matchesStatus = statusFilter === "all" || project.statusKey === statusFilter;
        const matchesCustomer = customerFilter === "all" || project.customerId === customerFilter;

        return matchesSearch && matchesStatus && matchesCustomer;
      })
      .sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }

        if (sortBy === "customer") {
          return a.customerName.localeCompare(b.customerName);
        }

        if (sortBy === "start_date") {
          return compareDateNullable(a.startDateRaw, b.startDateRaw);
        }

        if (sortBy === "progress") {
          return b.progress - a.progress;
        }

        return getProjectStatusLabel(a.statusKey, t).localeCompare(getProjectStatusLabel(b.statusKey, t));
      });
  }, [projects, searchTerm, statusFilter, customerFilter, sortBy, t]);

  const summary = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((project) => project.statusKey === "in_progress").length;
    const completed = projects.filter((project) => project.statusKey === "completed").length;
    const averageProgress =
      total === 0 ? 0 : Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / total);

    return { total, inProgress, completed, averageProgress };
  }, [projects]);

  const sortOptions: Array<{ value: SortKey; label: string }> = [
    { value: "name", label: t("projects.sortName") },
    { value: "customer", label: t("projects.sortCustomer") },
    { value: "start_date", label: t("projects.sortStartDate") },
    { value: "progress", label: t("projects.sortProgress") },
    { value: "status", label: t("projects.sortStatus") },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("projects.pageTitle")}
        description={t("projects.pageDescription")}
        primaryAction={
          <Link href="/projects/new">
            <Button size="lg">+ {t("projects.newProject")}</Button>
          </Link>
        }
      />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon="P" label={t("projects.summaryTotal")} value={String(summary.total)} />
        <SummaryCard icon="I" label={t("projects.summaryInProgress")} value={String(summary.inProgress)} />
        <SummaryCard icon="C" label={t("projects.summaryCompleted")} value={String(summary.completed)} />
        <SummaryCard icon="%" label={t("projects.summaryAvgProgress")} value={`${summary.averageProgress}%`} />
      </section>

      <TableContainer
        title={t("projects.directoryTitle")}
        description={t("projects.directoryDescription")}
        controls={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SearchInput
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("projects.searchPlaceholder")}
              aria-label={t("projects.searchPlaceholder")}
            />

            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label={t("projects.filterStatusLabel")}
            >
              <option value="all">{t("projects.filterAllStatuses")}</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {getProjectStatusLabel(status.value, t)}
                </option>
              ))}
            </Select>

            <Select
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
              aria-label={t("projects.filterCustomerLabel")}
            >
              <option value="all">{t("projects.filterAllCustomers")}</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.label}
                </option>
              ))}
            </Select>

            <Select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortKey)}
              aria-label={t("projects.sortByLabel")}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {isLoading ? (
          <ProjectsLoadingState />
        ) : errorMessage ? (
          <ErrorState title={t("projects.errorTitle")} description={errorMessage} />
        ) : filteredAndSortedProjects.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-[var(--color-border-subtle)]">
                <thead className="bg-[var(--color-surface-subtle)]">
                  <tr>
                    <TableHeading>{t("projects.tableProject")}</TableHeading>
                    <TableHeading>{t("projects.tableCustomer")}</TableHeading>
                    <TableHeading>{t("projects.tableStartDate")}</TableHeading>
                    <TableHeading>{t("projects.tableProgress")}</TableHeading>
                    <TableHeading>{t("projects.tableStatus")}</TableHeading>
                    <TableHeading>{t("projects.tableActions")}</TableHeading>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-subtle)] bg-white">
                  {filteredAndSortedProjects.map((project) => (
                    <tr key={project.id} className="transition hover:bg-[var(--color-surface-subtle)]">
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link href={`/projects/${project.id}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">
                          {project.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                        {project.customerName}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-secondary)]">
                        {project.startDate}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <ProgressCell value={project.progress} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <StatusBadge statusKey={project.statusKey} label={getProjectStatusLabel(project.statusKey, t)} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <Link href={`/projects/${project.id}`} className="font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                          {t("projects.viewWorkspace")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-4 p-4 md:hidden">
              {filteredAndSortedProjects.map((project) => (
                <Card key={project.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={`/projects/${project.id}`} className="text-base font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">
                          {project.name}
                        </Link>
                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{project.customerName}</p>
                      </div>
                      <StatusBadge statusKey={project.statusKey} label={getProjectStatusLabel(project.statusKey, t)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <InfoLine label={t("projects.tableStartDate")} value={project.startDate} />
                      <InfoLine label={t("projects.tableProgress")} value={`${project.progress}%`} />
                    </div>

                    <Link href={`/projects/${project.id}`} className="inline-flex text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                      {t("projects.viewWorkspace")}
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : projects.length === 0 ? (
          <EmptyState
            icon="P"
            title={t("projects.emptyTitle")}
            description={t("projects.emptyDescription")}
            action={
              <Link href="/projects/new">
                <Button>{t("projects.newProject")}</Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon="?"
            title={t("projects.filteredEmptyTitle")}
            description={t("projects.filteredEmptyDescription")}
          />
        )}
      </TableContainer>
    </div>
  );
}

function TableHeading({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]"
    >
      {children}
    </th>
  );
}

function ProjectsLoadingState() {
  return (
    <div className="space-y-4 p-6">
      <SectionHeader title="" description="" />
      <SkeletonLoader className="h-14 w-full" />
      <SkeletonLoader className="h-14 w-full" />
      <SkeletonLoader className="h-14 w-full" />
      <SkeletonLoader className="h-14 w-full" />
    </div>
  );
}

function ProgressCell({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div className="min-w-[130px]">
      <div className="mb-1 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>{normalized}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-2 rounded-full bg-[var(--color-brand-600)] transition-all"
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ statusKey, label }: { statusKey: string; label: string }) {
  const style = getProjectStatusBadgeClass(statusKey);

  return <Badge className={style}>{label}</Badge>;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function buildProjectProgressMap(tasks: TaskProgressRow[]) {
  const progressMap = new Map<string, { total: number; count: number }>();

  for (const task of tasks) {
    const projectId = task.project_id;

    if (!projectId) {
      continue;
    }

    const normalizedStatus = task.status.trim().toLowerCase();
    const progress = normalizedStatus === "completed" ? 100 : Math.max(0, Math.min(100, task.completion_percentage));
    const current = progressMap.get(projectId) || { total: 0, count: 0 };

    progressMap.set(projectId, {
      total: current.total + progress,
      count: current.count + 1,
    });
  }

  return Object.fromEntries(
    Array.from(progressMap.entries()).map(([projectId, data]) => [
      projectId,
      data.count > 0 ? Math.round(data.total / data.count) : 0,
    ]),
  ) as Record<string, number>;
}

function compareDateNullable(a: string | null, b: string | null) {
  const aTime = a ? new Date(`${a}T00:00:00`).getTime() : 0;
  const bTime = b ? new Date(`${b}T00:00:00`).getTime() : 0;

  if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
    return 0;
  }

  if (Number.isNaN(aTime)) {
    return 1;
  }

  if (Number.isNaN(bTime)) {
    return -1;
  }

  return bTime - aTime;
}

function getProjectStatusLabel(statusKey: string, t: (key: string) => string) {
  const statusLabelKey: Record<string, string> = {
    lead: "projects.statusLead",
    estimating: "projects.statusEstimating",
    approved: "projects.statusApproved",
    scheduled: "projects.statusScheduled",
    in_progress: "projects.statusInProgress",
    on_hold: "projects.statusOnHold",
    completed: "projects.statusCompleted",
    cancelled: "projects.statusCancelled",
  };

  return statusLabelKey[statusKey] ? t(statusLabelKey[statusKey]) : normalizeProjectStatus(statusKey).label;
}

function getCustomerDisplayName(customer: CustomerSummaryRow, fallbackLabel = "Unnamed Customer") {
  const companyName = customer.company_name?.trim() || "";
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) {
    return companyName;
  }

  return fallbackName || companyName || fallbackLabel;
}
