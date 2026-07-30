"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ProjectFilters,
  ProjectHeader,
  ProjectMetrics,
  ProjectTable,
  type ProjectTableItem,
} from "@/components/projects";
import { Button, EmptyState, ErrorState, SectionHeader, SkeletonLoader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import {
  formatProjectCurrency,
  formatProjectDate,
  getProjectDisplayName,
  normalizeProjectStatus,
  normalizeProjectType,
  type ProjectRow,
} from "@/lib/projects";
import { PROJECT_STATUSES } from "@/lib/projects/statuses";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "first_name" | "last_name" | "company_name" | "customer_type"
>;

type ProfileSummaryRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name"
>;

type TaskProgressRow = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "project_id" | "status" | "completion_percentage" | "created_at"
>;

type ProjectListItem = ProjectTableItem & {
  customerId: string | null;
  projectManagerId: string | null;
  projectTypeKey: string;
  searchText: string;
  isOverdue: boolean;
};

type ProjectsErrorKind = "auth" | "company" | "database" | "network" | "unknown";

export default function ProjectsPage() {
  const { t, locale } = useI18n();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ProjectsErrorKind | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectManagerFilter, setProjectManagerFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [projectTypeFilter, setProjectTypeFilter] = useState("all");

  const [customerOptions, setCustomerOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [projectManagerOptions, setProjectManagerOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [projectTypeOptions, setProjectTypeOptions] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    let isSubscribed = true;

    const loadProjects = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setErrorKind(null);

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          if (workspace.errorCode === "unauthenticated") {
            setErrorKind("auth");
            setErrorMessage(t("projects.errorAuthRequired"));
          } else if (workspace.errorCode === "profile_missing" || workspace.errorCode === "company_missing") {
            setErrorKind("company");
            setErrorMessage(t("projects.errorCompanyContext"));
          } else if (workspace.errorCode === "supabase_unavailable") {
            setErrorKind("network");
            setErrorMessage(t("projects.errorConnect"));
          } else {
            setErrorKind("unknown");
            setErrorMessage(workspace.errorMessage || t("projects.errorLoadWorkspace"));
          }
          setIsLoading(false);
        }

        return;
      }

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorKind("network");
          setErrorMessage(t("projects.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      try {
        const [projectsResponse, customersResponse, tasksResponse, profilesResponse] = await Promise.all([
          client
            .from("projects")
            .select("id, customer_id, name, status, estimated_start_date, estimated_end_date, contract_amount, estimated_cost, project_type, created_by, updated_at, created_at")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
          client
            .from("customers")
            .select("id, first_name, last_name, company_name, customer_type")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }),
          client
            .from("tasks")
            .select("project_id, status, completion_percentage, created_at")
            .eq("company_id", workspace.context.companyId),
          client
            .from("profiles")
            .select("id, first_name, last_name")
            .eq("company_id", workspace.context.companyId),
        ]);

        if (projectsResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadProjectsDetailed", { message: projectsResponse.error.message }));
          }

          return;
        }

        if (customersResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadCustomersDetailed", { message: customersResponse.error.message }));
          }

          return;
        }

        if (tasksResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadProjectProgressDetailed", { message: tasksResponse.error.message }));
          }

          return;
        }

        if (profilesResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadTeamProfiles"));
          }

          return;
        }

        const customerRows = (customersResponse.data ?? []) as CustomerSummaryRow[];
        const profileRows = (profilesResponse.data ?? []) as ProfileSummaryRow[];
        const taskRows = (tasksResponse.data ?? []) as TaskProgressRow[];

        const localeTag = locale === "es" ? "es-ES" : "en-US";
        const customerNameMap = new Map(
          customerRows.map((row) => [row.id, getCustomerDisplayName(row, t("customers.unnamedCustomer"))]),
        );
        const profileNameMap = new Map(profileRows.map((row) => [row.id, getProfileDisplayName(row, t("projects.notAssigned"))]));
        const progressByProjectId = buildProjectProgressMap(taskRows);
        const lastActivityByProjectId = buildLastActivityMap(taskRows);

        const mappedProjects = (projectsResponse.data ?? []).map((row) => {
          const project = row as Pick<
            ProjectRow,
            | "id"
            | "customer_id"
            | "name"
            | "status"
            | "estimated_start_date"
            | "estimated_end_date"
            | "contract_amount"
            | "estimated_cost"
            | "project_type"
            | "created_by"
            | "updated_at"
            | "created_at"
          >;
          const normalizedStatus = normalizeProjectStatus(project.status);
          const normalizedType = normalizeProjectType(project.project_type);
          const customerName = project.customer_id
            ? customerNameMap.get(project.customer_id) || t("projects.notLinked")
            : t("projects.notLinked");
          const projectManagerName = project.created_by
            ? profileNameMap.get(project.created_by) || t("projects.notAssigned")
            : t("projects.notAssigned");
          const statusLabel = getProjectStatusLabel(normalizedStatus.key, t);
          const projectTypeLabel = getProjectTypeLabel(normalizedType.key, t);
          const lastActivityAt = latestDate(project.updated_at, lastActivityByProjectId[project.id], project.created_at);
          const endDateRaw = project.estimated_end_date;

          return {
            id: project.id,
            projectName: getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject")),
            customerName,
            customerId: project.customer_id,
            projectManagerName,
            projectManagerId: project.created_by,
            statusKey: normalizedStatus.key,
            statusLabel,
            budgetLabel: formatProjectCurrency(
              project.contract_amount ?? project.estimated_cost,
              localeTag,
              t("projects.notProvided"),
            ),
            progress: progressByProjectId[project.id] ?? 0,
            startDateLabel: formatProjectDate(project.estimated_start_date, localeTag, t("projects.notProvided")),
            endDateLabel: formatProjectDate(endDateRaw, localeTag, t("projects.notProvided")),
            lastActivityLabel: formatProjectDate(lastActivityAt, localeTag, t("projects.notProvided")),
            projectTypeKey: normalizedType.key,
            isOverdue: isProjectOverdue(endDateRaw, normalizedStatus.key),
            searchText: [
              project.name,
              customerName,
              projectManagerName,
              statusLabel,
              projectTypeLabel,
            ]
              .join(" ")
              .toLowerCase(),
          };
        });

        const nextCustomerOptions = customerRows
          .map((row) => ({
            value: row.id,
            label: getCustomerDisplayName(row, t("customers.unnamedCustomer")),
          }))
          .sort((left, right) => left.label.localeCompare(right.label));

        const nextProjectManagerOptions = profileRows
          .map((row) => ({
            value: row.id,
            label: getProfileDisplayName(row, t("projects.notAssigned")),
          }))
          .sort((left, right) => left.label.localeCompare(right.label));

        const projectTypeMap = new Map<string, string>();
        for (const project of mappedProjects) {
          projectTypeMap.set(project.projectTypeKey, getProjectTypeLabel(project.projectTypeKey, t));
        }

        const nextProjectTypeOptions = Array.from(projectTypeMap.entries())
          .map(([value, label]) => ({ value, label }))
          .sort((left, right) => left.label.localeCompare(right.label));

        if (isSubscribed) {
          setProjects(mappedProjects);
          setCustomerOptions(nextCustomerOptions);
          setProjectManagerOptions(nextProjectManagerOptions);
          setProjectTypeOptions(nextProjectTypeOptions);
        }
      } catch (caughtError) {
        console.error("Load projects error:", caughtError);

        if (isSubscribed) {
          setErrorKind("network");
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

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return projects.filter((project) => {
      const matchesSearch = !normalizedSearch || project.searchText.includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || project.statusKey === statusFilter;
      const matchesProjectManager = projectManagerFilter === "all" || project.projectManagerId === projectManagerFilter;
      const matchesCustomer = customerFilter === "all" || project.customerId === customerFilter;
      const matchesProjectType = projectTypeFilter === "all" || project.projectTypeKey === projectTypeFilter;

      return matchesSearch && matchesStatus && matchesProjectManager && matchesCustomer && matchesProjectType;
    });
  }, [projects, searchTerm, statusFilter, projectManagerFilter, customerFilter, projectTypeFilter]);

  const summary = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((project) => !["completed", "cancelled"].includes(project.statusKey)).length;
    const completed = projects.filter((project) => project.statusKey === "completed").length;
    const overdue = projects.filter((project) => project.isOverdue).length;

    return {
      total,
      active,
      completed,
      overdue,
    };
  }, [projects]);

  const statusOptions = useMemo(() => {
    return [
      { value: "all", label: t("projects.filterAllStatuses") },
      ...PROJECT_STATUSES.map((status) => ({ value: status.value, label: getProjectStatusLabel(status.value, t) })),
    ];
  }, [t]);

  return (
    <div className="space-y-4">
      <ProjectHeader
        eyebrow={t("projects.headerEyebrow")}
        title={t("projects.pageTitle")}
        description={t("projects.pageDescription")}
        newProjectLabel={t("projects.newProject")}
        importLabel={t("projects.import")}
        comingSoonLabel={t("projects.comingSoon")}
      />

      <ProjectFilters
        searchValue={searchTerm}
        statusValue={statusFilter}
        managerValue={projectManagerFilter}
        customerValue={customerFilter}
        typeValue={projectTypeFilter}
        statusOptions={statusOptions}
        managerOptions={[
          { value: "all", label: t("projects.filterAllProjectManagers") },
          ...projectManagerOptions,
        ]}
        customerOptions={[
          { value: "all", label: t("projects.filterAllCustomers") },
          ...customerOptions,
        ]}
        typeOptions={[
          { value: "all", label: t("projects.filterAllProjectTypes") },
          ...projectTypeOptions,
        ]}
        onSearchChange={setSearchTerm}
        onStatusChange={setStatusFilter}
        onManagerChange={setProjectManagerFilter}
        onCustomerChange={setCustomerFilter}
        onTypeChange={setProjectTypeFilter}
        t={t}
      />

      <ProjectMetrics
        totalProjects={summary.total}
        activeProjects={summary.active}
        completedProjects={summary.completed}
        overdueProjects={summary.overdue}
        t={t}
      />

      {isLoading ? (
        <ProjectsLoadingState />
      ) : errorMessage ? (
        <ErrorState title={getProjectsErrorTitle(errorKind, t)} description={errorMessage} />
      ) : filteredProjects.length > 0 ? (
        <ProjectTable items={filteredProjects} t={t} />
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
          compact
        />
      )}
    </div>
  );
}

function ProjectsLoadingState() {
  return (
    <div className="space-y-3 rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-card)]">
      <SectionHeader title="" description="" />
      <SkeletonLoader className="h-14 w-full" />
      <SkeletonLoader className="h-14 w-full" />
      <SkeletonLoader className="h-14 w-full" />
      <SkeletonLoader className="h-14 w-full" />
    </div>
  );
}

function getProjectsErrorTitle(
  errorKind: ProjectsErrorKind | null,
  t: (key: string) => string,
) {
  if (errorKind === "auth") {
    return t("projects.errorTitleAuth");
  }

  if (errorKind === "company") {
    return t("projects.errorTitleCompany");
  }

  if (errorKind === "database") {
    return t("projects.errorTitleDatabase");
  }

  if (errorKind === "network") {
    return t("projects.errorTitleNetwork");
  }

  return t("projects.errorTitle");
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

function buildLastActivityMap(tasks: TaskProgressRow[]) {
  const lastActivityMap = new Map<string, string>();

  for (const task of tasks) {
    if (!task.project_id) {
      continue;
    }

    const current = lastActivityMap.get(task.project_id);
    const latest = latestDate(task.created_at, current);

    if (latest) {
      lastActivityMap.set(task.project_id, latest);
    }
  }

  return Object.fromEntries(lastActivityMap.entries()) as Record<string, string>;
}

function latestDate(...values: Array<string | null | undefined>) {
  let latest = "";
  let latestTime = -1;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const raw = value.includes("T") ? value : `${value}T00:00:00`;
    const timestamp = new Date(raw).getTime();

    if (Number.isNaN(timestamp)) {
      continue;
    }

    if (timestamp > latestTime) {
      latestTime = timestamp;
      latest = value;
    }
  }

  return latest || null;
}

function isProjectOverdue(endDate: string | null, statusKey: string) {
  if (!endDate || ["completed", "cancelled"].includes(statusKey)) {
    return false;
  }

  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(due.getTime())) {
    return false;
  }

  return due.getTime() < cutoff.getTime();
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

function getProjectTypeLabel(projectTypeKey: string, t: (key: string) => string) {
  const typeLabelKey: Record<string, string> = {
    residential: "projects.typeResidential",
    commercial: "projects.typeCommercial",
    maintenance: "projects.typeMaintenance",
    renovation: "projects.typeRenovation",
    new_construction: "projects.typeNewConstruction",
    other: "projects.typeOther",
  };

  return typeLabelKey[projectTypeKey] ? t(typeLabelKey[projectTypeKey]) : normalizeProjectType(projectTypeKey).label;
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

function getProfileDisplayName(profile: ProfileSummaryRow, fallbackLabel = "Not assigned") {
  const firstName = profile.first_name?.trim() || "";
  const lastName = profile.last_name?.trim() || "";

  return [firstName, lastName].filter(Boolean).join(" ") || fallbackLabel;
}
