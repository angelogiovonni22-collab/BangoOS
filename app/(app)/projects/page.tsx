"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  ProjectFilters,
  ProjectsPageKpi,
  ProjectTable,
  type ProjectTableItem,
} from "@/components/projects";
import { EmptyState, ErrorState, PageHeader, SkeletonLoader } from "@/components/ui";
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
import { hasBosPermission } from "@/lib/access-control/permissions";
import { useCompany } from "@/lib/company";
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
  "project_id" | "status" | "completion_percentage"
>;

type InvoiceSpendRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  "project_id" | "amount_paid"
>;

type ProjectListItem = ProjectTableItem & {
  customerId: string | null;
  superintendentId: string | null;
  projectTypeKey: string;
  searchText: string;
  isOverdue: boolean;
  completedAtRaw: string | null;
};

type ProjectsErrorKind = "auth" | "company" | "database" | "network" | "unknown";
type SummaryView = "active" | "behind" | "risk" | "completed" | null;

export default function ProjectsPage() {
  const { t, locale } = useI18n();
  const company = useCompany();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ProjectsErrorKind | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [superintendentFilter, setSuperintendentFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [projectTypeFilter, setProjectTypeFilter] = useState("all");
  const [summaryView, setSummaryView] = useState<SummaryView>(null);

  const [customerOptions, setCustomerOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [superintendentOptions, setSuperintendentOptions] = useState<Array<{ value: string; label: string }>>([]);
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
      const canViewFinancials = hasBosPermission(workspace.context.role, "project_financials.view");
      const canViewCustomers = hasBosPermission(workspace.context.role, "customers.view");
      const canViewWorkforce = hasBosPermission(workspace.context.role, "workforce.view");

      if (!client) {
        if (isSubscribed) {
          setErrorKind("network");
          setErrorMessage(t("projects.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      try {
        const projectsResponse = await (canViewFinancials ? client
          .from("projects")
          .select("id, customer_id, name, status, estimated_end_date, contract_amount, estimated_cost, project_type, created_by, actual_end_date, updated_at, created_at")
          .eq("company_id", workspace.context.companyId)
          .order("created_at", { ascending: false }) : client
          .from("projects")
          .select("id, customer_id, name, status, estimated_end_date, project_type, created_by, actual_end_date, updated_at, created_at")
          .eq("company_id", workspace.context.companyId)
          .order("created_at", { ascending: false }));

        if (projectsResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadProjectsDetailed", { message: projectsResponse.error.message }));
          }
          return;
        }

        const projectIds = (projectsResponse.data ?? []).map((project) => project.id);
        const [customersResponse, tasksResponse, profilesResponse, invoicesResponse] = await Promise.all([
          canViewCustomers ? client
            .from("customers")
            .select("id, first_name, last_name, company_name, customer_type")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
          projectIds.length > 0 ? client
            .from("tasks")
            .select("project_id, status, completion_percentage")
            .eq("company_id", workspace.context.companyId)
            .in("project_id", projectIds) : Promise.resolve({ data: [], error: null }),
          canViewWorkforce ? client
            .from("profiles")
            .select("id, first_name, last_name")
            .eq("company_id", workspace.context.companyId) : Promise.resolve({ data: [], error: null }),
          canViewFinancials ? client
            .from("invoices")
            .select("project_id, amount_paid")
            .eq("company_id", workspace.context.companyId) : Promise.resolve({ data: [], error: null }),
        ]);

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

        if (invoicesResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadInvoices"));
          }
          return;
        }

        const customerRows = (customersResponse.data ?? []) as CustomerSummaryRow[];
        const profileRows = (profilesResponse.data ?? []) as ProfileSummaryRow[];
        const taskRows = (tasksResponse.data ?? []) as TaskProgressRow[];
        const invoiceRows = (invoicesResponse.data ?? []) as InvoiceSpendRow[];

        const localeTag = locale === "es" ? "es-ES" : "en-US";
        const customerNameMap = new Map(
          customerRows.map((row) => [row.id, getCustomerDisplayName(row, t("customers.unnamedCustomer"))]),
        );
        const profileNameMap = new Map(profileRows.map((row) => [row.id, getProfileDisplayName(row, t("projects.notAssigned"))]));
        const progressByProjectId = buildProjectProgressMap(taskRows);
        const spentByProjectId = buildInvoiceSpentMap(invoiceRows);

        const mappedProjects = (projectsResponse.data ?? []).map((row) => {
          const project = { contract_amount: null, estimated_cost: null, ...row } as Pick<
            ProjectRow,
            | "id"
            | "customer_id"
            | "name"
            | "status"
            | "estimated_end_date"
            | "contract_amount"
            | "estimated_cost"
            | "project_type"
            | "created_by"
            | "actual_end_date"
            | "updated_at"
            | "created_at"
          >;

          const normalizedStatus = normalizeProjectStatus(project.status);
          const normalizedType = normalizeProjectType(project.project_type);
          const customerName = project.customer_id
            ? customerNameMap.get(project.customer_id) || t("projects.notLinked")
            : t("projects.notLinked");
          const superintendentName = project.created_by
            ? profileNameMap.get(project.created_by) || t("projects.notAssigned")
            : t("projects.notAssigned");
          const statusLabel = getProjectStatusLabel(normalizedStatus.key, t);
          const projectTypeLabel = getProjectTypeLabel(normalizedType.key, t);
          const progress = progressByProjectId[project.id] ?? 0;
          const budgetValue = project.contract_amount ?? project.estimated_cost;
          const spentValue = spentByProjectId[project.id] ?? 0;
          const endDateRaw = project.estimated_end_date;
          const isOverdue = isProjectOverdue(endDateRaw, normalizedStatus.key);
          const healthKey = getProjectHealth({
            statusKey: normalizedStatus.key,
            progress,
            dueDate: endDateRaw,
            isOverdue,
          });
          const healthLabel = getProjectHealthLabel(healthKey);

          return {
            id: project.id,
            projectName: getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject")),
            customerName,
            customerId: project.customer_id,
            superintendentName,
            superintendentId: project.created_by,
            statusKey: normalizedStatus.key,
            statusLabel,
            progress,
            budgetLabel: formatProjectCurrency(
              budgetValue,
              localeTag,
              t("projects.notProvided"),
            ),
            spentLabel: formatProjectCurrency(spentValue, localeTag, "$0"),
            profitMarginLabel: formatProfitMarginLabel(budgetValue, spentValue),
            dueDateLabel: formatProjectDate(endDateRaw, localeTag, t("projects.notProvided")),
            healthKey,
            healthLabel,
            projectTypeKey: normalizedType.key,
            isOverdue,
            completedAtRaw: project.actual_end_date || project.updated_at || project.created_at,
            searchText: [
              project.name,
              customerName,
              superintendentName,
              statusLabel,
              projectTypeLabel,
              healthLabel,
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

        const nextSuperintendentOptions = profileRows
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
          setSuperintendentOptions(nextSuperintendentOptions);
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
      const matchesSuperintendent = superintendentFilter === "all" || project.superintendentId === superintendentFilter;
      const matchesCustomer = customerFilter === "all" || project.customerId === customerFilter;
      const matchesProjectType = projectTypeFilter === "all" || project.projectTypeKey === projectTypeFilter;
      const matchesSummary = !summaryView
        || (summaryView === "active" && !["completed", "cancelled"].includes(project.statusKey))
        || (summaryView === "behind" && project.isOverdue)
        || (summaryView === "risk" && ["at_risk", "behind"].includes(project.healthKey))
        || (summaryView === "completed" && project.statusKey === "completed" && isCurrentMonth(project.completedAtRaw));

      return matchesSearch && matchesStatus && matchesSuperintendent && matchesCustomer && matchesProjectType && matchesSummary;
    });
  }, [projects, searchTerm, statusFilter, superintendentFilter, customerFilter, projectTypeFilter, summaryView]);

  const summary = useMemo(() => {
    const activeProjects = projects.filter((project) => !["completed", "cancelled"].includes(project.statusKey)).length;
    const behindSchedule = projects.filter((project) => project.isOverdue).length;
    const atRisk = projects.filter((project) => ["at_risk", "behind"].includes(project.healthKey)).length;
    const completedThisMonth = projects.filter((project) => {
      if (project.statusKey !== "completed") return false;
      return isCurrentMonth(project.completedAtRaw);
    }).length;

    return { activeProjects, behindSchedule, atRisk, completedThisMonth };
  }, [projects]);

  const statusOptions = useMemo(() => {
    return [
      { value: "all", label: t("projects.filterAllStatuses") },
      ...PROJECT_STATUSES.map((status) => ({ value: status.value, label: getProjectStatusLabel(status.value, t) })),
    ];
  }, [t]);

  const canManageProjects = hasBosPermission(company.role, "projects.manage");
  const showFinancials = hasBosPermission(company.role, "project_financials.view");
  const toggleSummaryView = (next: Exclude<SummaryView, null>) => setSummaryView((current) => current === next ? null : next);

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow={t("projects.headerEyebrow")}
        title={t("projects.pageTitle")}
        description={t("projects.pageDescription")}
        primaryAction={canManageProjects ? (
          <Link href="/projects/new" className={getButtonClassName({ size: "md" })}><Plus size={16} aria-hidden="true" />
              {t("projects.newProject")}</Link>
        ) : undefined}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Project performance summary">
        <ProjectsPageKpi label="Active Projects" value={summary.activeProjects.toLocaleString()} tone="brand" selected={summaryView === "active"} onClick={() => toggleSummaryView("active")} />
        <ProjectsPageKpi label="Behind Schedule" value={summary.behindSchedule.toLocaleString()} tone="warning" selected={summaryView === "behind"} onClick={() => toggleSummaryView("behind")} />
        <ProjectsPageKpi label="At Risk" value={summary.atRisk.toLocaleString()} tone="danger" selected={summaryView === "risk"} onClick={() => toggleSummaryView("risk")} />
        <ProjectsPageKpi label="Completed This Month" value={summary.completedThisMonth.toLocaleString()} tone="success" selected={summaryView === "completed"} onClick={() => toggleSummaryView("completed")} />
      </section>

      <ProjectFilters
        searchValue={searchTerm}
        statusValue={statusFilter}
        managerValue={superintendentFilter}
        customerValue={customerFilter}
        typeValue={projectTypeFilter}
        statusOptions={statusOptions}
        managerOptions={[
          { value: "all", label: t("projects.filterAllProjectManagers") },
          ...superintendentOptions,
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
        onManagerChange={setSuperintendentFilter}
        onCustomerChange={setCustomerFilter}
        onTypeChange={setProjectTypeFilter}
        t={t}
      />

      {isLoading ? (
        <ProjectsLoadingState />
      ) : errorMessage ? (
        <ErrorState title={getProjectsErrorTitle(errorKind, t)} description={errorMessage} compact />
      ) : filteredProjects.length > 0 ? (
        <ProjectTable items={filteredProjects} t={t} canManageProjects={canManageProjects} showFinancials={showFinancials} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon="P"
          title="No projects yet"
          description="Create your first project to start scheduling work, tracking spend, and monitoring profitability."
          action={canManageProjects ?
            <Link href="/projects/new" className={getButtonClassName({})}>{t("projects.newProject")}</Link>
          : undefined}
        />
      ) : (
        <EmptyState
          icon="?"
          title="No projects match this filter"
          description="Try adjusting your search, KPI selection, or filters to find the project you need."
          compact
        />
      )}
    </div>
  );
}

function ProjectsLoadingState() {
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

function getProjectsErrorTitle(
  errorKind: ProjectsErrorKind | null,
  t: (key: string) => string,
) {
  if (errorKind === "auth") return t("projects.errorTitleAuth");
  if (errorKind === "company") return t("projects.errorTitleCompany");
  if (errorKind === "database") return t("projects.errorTitleDatabase");
  if (errorKind === "network") return t("projects.errorTitleNetwork");
  return t("projects.errorTitle");
}

function buildProjectProgressMap(tasks: TaskProgressRow[]) {
  const progressMap = new Map<string, { total: number; count: number }>();

  for (const task of tasks) {
    const projectId = task.project_id;
    if (!projectId) continue;

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

function buildInvoiceSpentMap(invoices: InvoiceSpendRow[]) {
  const spentMap = new Map<string, number>();

  for (const invoice of invoices) {
    if (!invoice.project_id) continue;
    const current = spentMap.get(invoice.project_id) || 0;
    spentMap.set(invoice.project_id, current + Math.max(0, invoice.amount_paid));
  }

  return Object.fromEntries(spentMap.entries()) as Record<string, number>;
}

function isProjectOverdue(endDate: string | null, statusKey: string) {
  if (!endDate || ["completed", "cancelled"].includes(statusKey)) return false;

  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < cutoff.getTime();
}

function getProjectHealth(input: {
  statusKey: string;
  progress: number;
  dueDate: string | null;
  isOverdue: boolean;
}): ProjectTableItem["healthKey"] {
  if (input.statusKey === "completed") return "complete";
  if (input.isOverdue) return "behind";
  if (!input.dueDate || input.statusKey === "cancelled") return "on_track";

  const dueDate = new Date(`${input.dueDate}T00:00:00Z`);
  if (Number.isNaN(dueDate.getTime())) return "on_track";

  const now = new Date();
  const msUntilDue = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.ceil(msUntilDue / (1000 * 60 * 60 * 24));

  if (daysUntilDue <= 14 && input.progress < 65) return "at_risk";
  return "on_track";
}

function getProjectHealthLabel(healthKey: ProjectTableItem["healthKey"]) {
  if (healthKey === "complete") return "Complete";
  if (healthKey === "behind") return "Behind";
  if (healthKey === "at_risk") return "At Risk";
  return "On Track";
}

function formatProfitMarginLabel(budget: number | null, spent: number) {
  if (typeof budget !== "number" || budget <= 0 || spent <= 0) return "Not available";
  const margin = ((budget - spent) / budget) * 100;
  return `${margin.toFixed(1)}%`;
}

function isCurrentMonth(dateValue: string | null) {
  if (!dateValue) return false;

  const parsedDate = dateValue.includes("T")
    ? new Date(dateValue)
    : new Date(`${dateValue}T00:00:00Z`);

  if (Number.isNaN(parsedDate.getTime())) return false;

  const now = new Date();
  return parsedDate.getUTCFullYear() === now.getUTCFullYear()
    && parsedDate.getUTCMonth() === now.getUTCMonth();
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

  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) return companyName;
  return fallbackName || companyName || fallbackLabel;
}

function getProfileDisplayName(profile: ProfileSummaryRow, fallbackLabel = "Not assigned") {
  const firstName = profile.first_name?.trim() || "";
  const lastName = profile.last_name?.trim() || "";
  return [firstName, lastName].filter(Boolean).join(" ") || fallbackLabel;
}
