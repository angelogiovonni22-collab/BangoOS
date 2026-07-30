"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlansWorkspace } from "@/components/plans";
import { Button, EmptyState, ErrorState, SkeletonLoader } from "@/components/ui";
import {
  ProjectEmptyTab,
  ProjectOverview,
  ProjectSidebar,
  ProjectSummaryCards,
  ProjectTabs,
  ProjectWorkspaceHeader,
  type ProjectWorkspaceTabKey,
  type WorkspaceActivityItem,
  type WorkspaceContactItem,
  type WorkspaceMilestoneItem,
  type WorkspaceQuickAction,
} from "@/components/projects/workspace";
import { createCrewService, type ProjectCrewAssignmentSummary } from "@/lib/crews";
import {
  formatProjectAddress,
  formatProjectCurrency,
  formatProjectDateLong,
  getProjectDisplayName,
  normalizeProjectStatus,
  type ProjectRow,
} from "@/lib/projects";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type ProjectSummary = Pick<
  ProjectRow,
  | "id"
  | "name"
  | "project_number"
  | "project_type"
  | "status"
  | "customer_id"
  | "created_by"
  | "address_line_1"
  | "address_line_2"
  | "city"
  | "state"
  | "postal_code"
  | "estimated_cost"
  | "contract_amount"
  | "estimated_start_date"
  | "estimated_end_date"
  | "actual_end_date"
  | "created_at"
  | "updated_at"
>;

type CustomerSummary = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "first_name" | "last_name" | "company_name" | "customer_type" | "email" | "phone"
>;

type ProfileSummary = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name" | "role"
>;

type TaskSummary = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  | "id"
  | "title"
  | "status"
  | "completion_percentage"
  | "planned_start"
  | "planned_finish"
  | "assigned_profile_id"
  | "created_at"
  | "updated_at"
>;

type InvoiceSummary = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  | "id"
  | "invoice_number"
  | "title"
  | "status"
  | "total_amount"
  | "amount_paid"
  | "due_date"
  | "issue_date"
  | "created_at"
  | "updated_at"
>;

type WorkspaceTab = ProjectWorkspaceTabKey;

type WorkspaceState = {
  project: ProjectSummary;
  customer: CustomerSummary | null;
  profilesById: Record<string, string>;
  tasks: TaskSummary[];
  invoices: InvoiceSummary[];
  crewAssignments: ProjectCrewAssignmentSummary[];
  workspaceContext: WorkspaceContext;
};

type WorkspaceErrorKind = "auth" | "company" | "database" | "network" | "unknown";

export default function ProjectWorkspacePage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id?: string | string[] }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const supabase = useMemo(() => createClient(), []);
  const crewService = useMemo(() => createCrewService(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<WorkspaceErrorKind | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState | null>(null);

  const activeTab = resolveWorkspaceTab(searchParams.get("tab"));

  const handleTabChange = (tab: WorkspaceTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (tab === "overview") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }

    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(nextUrl);
  };

  useEffect(() => {
    let isSubscribed = true;

    const loadWorkspace = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setErrorKind(null);
      setNotFound(false);

      if (!projectId) {
        if (isSubscribed) {
          setErrorMessage(t("projects.errorReadProjectId"));
          setIsLoading(false);
        }

        return;
      }

      const workspaceResult = await resolveWorkspaceContext(supabase);

      if (workspaceResult.errorMessage || !workspaceResult.context) {
        if (isSubscribed) {
          setErrorKind(mapWorkspaceErrorKind(workspaceResult.errorCode));
          setErrorMessage(workspaceResult.errorMessage || t("projects.errorLoadWorkspace"));
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
        const projectResponse = await client
          .from("projects")
          .select(
            "id, name, project_number, project_type, status, customer_id, created_by, address_line_1, address_line_2, city, state, postal_code, estimated_cost, contract_amount, estimated_start_date, estimated_end_date, actual_end_date, created_at, updated_at",
          )
          .eq("id", projectId)
          .eq("company_id", workspaceResult.context.companyId)
          .maybeSingle<ProjectSummary>();

        if (projectResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadProject"));
          }

          return;
        }

        if (!projectResponse.data) {
          if (isSubscribed) {
            setNotFound(true);
          }

          return;
        }

        const loadedProject = projectResponse.data;
        const customerQuery = loadedProject.customer_id
          ? client
              .from("customers")
              .select("id, first_name, last_name, company_name, customer_type, email, phone")
              .eq("company_id", workspaceResult.context.companyId)
              .eq("id", loadedProject.customer_id)
              .maybeSingle<CustomerSummary>()
          : Promise.resolve({ data: null, error: null });

        const [profilesResponse, tasksResponse, invoicesResponse, customerResponse, crewAssignments] = await Promise.all([
          client
            .from("profiles")
            .select("id, first_name, last_name, role")
            .eq("company_id", workspaceResult.context.companyId),
          client
            .from("tasks")
            .select("id, title, status, completion_percentage, planned_start, planned_finish, assigned_profile_id, created_at, updated_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("planned_start", { ascending: true })
            .order("created_at", { ascending: true }),
          client
            .from("invoices")
            .select("id, invoice_number, title, status, total_amount, amount_paid, due_date, issue_date, created_at, updated_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
          customerQuery,
          crewService.getCrewsForProject(getProjectDisplayName(loadedProject as ProjectRow, "")),
        ]);

        if (profilesResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadTeamProfiles"));
          }

          return;
        }

        if (tasksResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadSchedule"));
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

        if (customerResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadProjectCustomer"));
          }

          return;
        }

        const profileRows = (profilesResponse.data ?? []) as ProfileSummary[];
        const taskRows = (tasksResponse.data ?? []) as TaskSummary[];
        const invoiceRows = (invoicesResponse.data ?? []) as InvoiceSummary[];
        const customerRow = (customerResponse.data ?? null) as CustomerSummary | null;
        const profileMap = buildProfileNameMap(profileRows, t("projects.notAssigned"));

        if (isSubscribed) {
          setWorkspace({
            project: loadedProject,
            customer: customerRow,
            profilesById: profileMap,
            tasks: taskRows,
            invoices: invoiceRows,
            crewAssignments,
            workspaceContext: workspaceResult.context,
          });
        }
      } catch (caughtError) {
        console.error("Load project workspace error:", caughtError);

        if (isSubscribed) {
          setErrorKind("network");
          setErrorMessage(t("projects.errorUnexpectedWorkspace"));
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadWorkspace();

    return () => {
      isSubscribed = false;
    };
  }, [crewService, projectId, supabase, t]);

  if (isLoading) {
    return <ProjectWorkspaceLoadingState />;
  }

  if (errorMessage && !workspace) {
    return <ErrorState title={getWorkspaceErrorTitle(errorKind, t)} description={getWorkspaceErrorDescription(errorMessage, t)} />;
  }

  if (notFound || !workspace) {
    return (
      <EmptyState
        icon="?"
        title={t("projects.projectNotFoundTitle")}
        description={t("projects.projectNotFoundDescription")}
        action={
          <Link href="/projects">
            <Button>{t("projects.backToProjects")}</Button>
          </Link>
        }
      />
    );
  }

  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const project = workspace.project;
  const customerName = workspace.customer ? getCustomerDisplayName(workspace.customer, t("customers.unnamedCustomer")) : t("projects.notLinked");
  const projectManager = workspace.project.created_by ? workspace.profilesById[workspace.project.created_by] || t("projects.notAssigned") : t("projects.notAssigned");
  const location = formatProjectAddress(project as ProjectRow) || t("projects.notProvided");
  const status = normalizeProjectStatus(project.status);
  const statusLabel = getProjectStatusLabel(status.key, t);
  const startDate = formatProjectDateLong(project.estimated_start_date, localeTag, t("projects.notProvided"));
  const completionDate = formatProjectDateLong(project.actual_end_date || project.estimated_end_date, localeTag, t("projects.notProvided"));
  const budgetValue = formatProjectCurrency(project.contract_amount ?? project.estimated_cost, localeTag, t("projects.notProvided"));
  const estimatedCostValue = formatProjectCurrency(project.estimated_cost, localeTag, t("projects.notProvided"));
  const profitValue = formatProjectCurrency(calculateProfit(project.contract_amount, project.estimated_cost), localeTag, t("projects.notProvided"));
  const progress = calculateProjectProgress(workspace.tasks);
  const crewCount = workspace.crewAssignments.length;
  const crewMemberCount = workspace.crewAssignments.reduce((sum, crew) => sum + crew.actualManpower, 0);
  const invoicesOutstanding = workspace.invoices.filter((invoice) => isInvoiceOutstanding(invoice.status, invoice.amount_paid, invoice.total_amount));
  const outstandingInvoicesValue = formatProjectCurrency(
    invoicesOutstanding.reduce((sum, invoice) => sum + Math.max(0, invoice.total_amount - invoice.amount_paid), 0),
    localeTag,
    t("projects.notProvided"),
  );

  const scheduleHealth = getScheduleHealth(workspace.project, workspace.tasks, localeTag, t);
  const budgetHealth = getBudgetHealth(workspace.project, localeTag, t);
  const safetyHealth = getSafetyHealth(t);
  const progressHealth = getProgressHealth(progress, t);
  const overallHealth = getOverallHealth([scheduleHealth.score, budgetHealth.score, safetyHealth.score, progressHealth.score], t);

  const summaryOpenDailyReports = "0";
  const summaryOpenSafetyItems = "0";
  const summaryEquipmentAssigned = "0";
  const summaryInvoicesOutstanding = String(invoicesOutstanding.length);
  const summaryCrew = crewCount > 0 ? t("projects.workspaceCrewSummaryValue", { crewCount, crewMembers: crewMemberCount }) : t("projects.workspaceCrewSummaryEmpty");

  const summaryCards = {
    budget: budgetValue,
    scheduleHealth: scheduleHealth.label,
    crewAssigned: summaryCrew,
    openDailyReports: summaryOpenDailyReports,
    openSafetyItems: summaryOpenSafetyItems,
    equipmentAssigned: summaryEquipmentAssigned,
    invoicesOutstanding: summaryInvoicesOutstanding,
  };

  const recentActivity = buildRecentActivity({
    project,
    customer: workspace.customer,
    tasks: workspace.tasks,
    invoices: workspace.invoices,
    profilesById: workspace.profilesById,
    localeTag,
    t,
  });

  const upcomingSchedule = buildUpcomingSchedule(project.id, workspace.tasks, localeTag, t).slice(0, 4);
  const milestones = buildMilestones(project, workspace.tasks, localeTag, t);
  const openIssues = buildOpenIssues(workspace.tasks, invoicesOutstanding, localeTag, t);
  const dailyReports: WorkspaceActivityItem[] = [];

  const projectContacts: WorkspaceContactItem[] = [
    {
      id: "customer",
      label: t("projects.workspacePrimaryCustomer"),
      value: customerName,
      role: workspace.customer?.email?.trim() || workspace.customer?.phone?.trim() || t("projects.notProvided"),
    },
    {
      id: "manager",
      label: t("projects.workspaceProjectManager"),
      value: projectManager,
      role: t("projects.workspacePrimaryManagerRole"),
    },
    {
      id: "crew",
      label: t("projects.workspaceCrewContact"),
      value: workspace.crewAssignments[0]?.crewName || t("projects.workspaceNoCrew"),
      role: workspace.crewAssignments[0]?.role || t("projects.notAssigned"),
    },
  ];

  const quickActions: WorkspaceQuickAction[] = [
    {
      id: "change-order",
      label: "New Change Order",
      href: `/change-orders/new?projectId=${project.id}${project.customer_id ? `&customerId=${project.customer_id}` : ""}`,
    },
    {
      id: "invoice",
      label: "New Invoice",
      href: `/invoices/new?projectId=${project.id}${project.customer_id ? `&customerId=${project.customer_id}` : ""}`,
    },
    { id: "report", label: t("projects.workspaceActionDailyReport"), disabled: true, title: t("projects.comingSoon") },
    { id: "schedule", label: t("projects.workspaceActionSchedule"), disabled: true, title: t("projects.comingSoon") },
    { id: "crew", label: t("projects.workspaceActionCrew"), disabled: true, title: t("projects.comingSoon") },
    { id: "plans", label: t("projects.workspaceActionPlans"), disabled: true, title: t("projects.comingSoon") },
  ];

  const sidebarMilestones = milestones.slice(0, 3);
  const sidebarActivity = recentActivity.slice(0, 4);
  const aiSummary = t("projects.workspaceAiSummaryPlaceholder");

  return (
    <div className="space-y-7">
      <ProjectWorkspaceHeader
        projectName={getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject"))}
        customerName={customerName}
        statusKey={status.key}
        statusLabel={statusLabel}
        projectManager={projectManager}
        location={location}
        startDate={startDate}
        estimatedCompletion={completionDate}
        budget={budgetValue}
        progress={progress}
        editDisabledLabel={t("projects.workspaceEditComingSoon")}
        shareLabel={t("projects.workspaceShare")}
        moreLabel={t("projects.workspaceMore")}
        comingSoonLabel={t("projects.comingSoon")}
        onShare={() => void shareWorkspace(project.id, t)}
        t={t}
      />

      <ProjectSummaryCards
        budget={summaryCards.budget}
        scheduleHealth={summaryCards.scheduleHealth}
        crewAssigned={summaryCards.crewAssigned}
        openDailyReports={summaryCards.openDailyReports}
        openSafetyItems={summaryCards.openSafetyItems}
        equipmentAssigned={summaryCards.equipmentAssigned}
        invoicesOutstanding={summaryCards.invoicesOutstanding}
        t={t}
      />

      <ProjectTabs activeTab={activeTab} onChange={handleTabChange} t={t} />

      <div
        className={`grid gap-6 ${
          activeTab === "plans"
            ? "xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]"
            : "xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_380px]"
        }`}
      >
        <main className="space-y-6">
          {activeTab === "overview" ? (
            <ProjectOverview
              healthItems={[
                {
                  label: t("projects.workspaceHealthSchedule"),
                  value: scheduleHealth.label,
                  tone: scheduleHealth.tone,
                  description: scheduleHealth.description,
                },
                {
                  label: t("projects.workspaceHealthBudget"),
                  value: budgetHealth.label,
                  tone: budgetHealth.tone,
                  description: budgetHealth.description,
                },
                {
                  label: t("projects.workspaceHealthSafety"),
                  value: safetyHealth.label,
                  tone: safetyHealth.tone,
                  description: safetyHealth.description,
                },
                {
                  label: t("projects.workspaceHealthProgress"),
                  value: progressHealth.label,
                  tone: progressHealth.tone,
                  description: progressHealth.description,
                },
              ]}
              overallHealth={overallHealth}
              recentActivity={recentActivity.slice(0, 4)}
              upcomingSchedule={upcomingSchedule}
              crewTitle={t("projects.overviewCrewSummary")}
              crewItems={workspace.crewAssignments}
              budgetTitle={t("projects.overviewBudgetSnapshot")}
              budget={budgetValue}
              estimatedCost={estimatedCostValue}
              profit={profitValue}
              invoicesOutstanding={outstandingInvoicesValue}
              openIssues={openIssues}
              milestones={milestones}
              dailyReports={dailyReports}
              t={t}
            />
          ) : activeTab === "plans" ? (
            <PlansWorkspace projectName={getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject"))} />
          ) : (
            <ProjectEmptyTab
              title={t("projects.workspaceTabComingSoonTitle")}
              description={t("projects.workspaceTabComingSoonDescription")}
              tabLabel={t(getWorkspaceTabLabelKey(activeTab))}
            />
          )}
        </main>

        <ProjectSidebar
          contacts={projectContacts}
          quickActions={quickActions}
          milestones={sidebarMilestones}
          activity={sidebarActivity}
          aiSummary={aiSummary}
          t={t}
        />
      </div>
    </div>
  );
}

function ProjectWorkspaceLoadingState() {
  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="space-y-2">
          <SkeletonLoader className="h-8 w-72" />
          <SkeletonLoader className="h-5 w-96" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
          <SkeletonLoader className="h-20 w-full" />
        </div>
      </div>
      <SkeletonLoader className="h-20 w-full" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <SkeletonLoader className="h-12 w-full" />
          <SkeletonLoader className="h-72 w-full" />
          <SkeletonLoader className="h-72 w-full" />
        </div>
        <SkeletonLoader className="h-[720px] w-full" />
      </div>
    </div>
  );
}

function getWorkspaceErrorTitle(errorKind: WorkspaceErrorKind | null, t: (key: string) => string) {
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

function resolveWorkspaceTab(tabParam: string | null): WorkspaceTab {
  const validTabs: WorkspaceTab[] = [
    "overview",
    "daily_reports",
    "scheduling",
    "crew",
    "equipment",
    "safety",
    "plans",
    "financials",
    "ai_insights",
  ];

  if (!tabParam) {
    return "overview";
  }

  return validTabs.includes(tabParam as WorkspaceTab) ? (tabParam as WorkspaceTab) : "overview";
}

function getWorkspaceErrorDescription(fallback: string, t: (key: string) => string) {
  if (fallback.includes("sign in")) {
    return t("projects.errorAuthRequired");
  }

  return fallback;
}

function mapWorkspaceErrorKind(errorCode: string | null): WorkspaceErrorKind {
  if (errorCode === "unauthenticated") {
    return "auth";
  }

  if (errorCode === "profile_missing" || errorCode === "company_missing") {
    return "company";
  }

  if (errorCode === "supabase_unavailable") {
    return "network";
  }

  return "unknown";
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

function buildProfileNameMap(rows: ProfileSummary[], fallbackLabel: string) {
  return Object.fromEntries(
    rows.map((row) => {
      const fullName = `${row.first_name?.trim() || ""} ${row.last_name?.trim() || ""}`.trim();
      return [row.id, fullName || fallbackLabel] as const;
    }),
  );
}

function getCustomerDisplayName(customer: CustomerSummary, fallbackLabel = "Unnamed Customer") {
  const companyName = customer.company_name?.trim() || "";
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) {
    return companyName;
  }

  return fallbackName || companyName || fallbackLabel;
}

function buildRecentActivity({
  project,
  customer,
  tasks,
  invoices,
  profilesById,
  localeTag,
  t,
}: {
  project: ProjectSummary;
  customer: CustomerSummary | null;
  tasks: TaskSummary[];
  invoices: InvoiceSummary[];
  profilesById: Record<string, string>;
  localeTag: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}): WorkspaceActivityItem[] {
  const items: WorkspaceActivityItem[] = [
    {
      id: "project-created",
      title: t("projects.workspaceActivityProjectCreatedTitle"),
      detail: t("projects.workspaceActivityProjectCreatedDetail", { project: getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject")) }),
      timestamp: formatDateTime(project.created_at, localeTag),
      tone: "indigo",
    },
  ];

  if (customer) {
    items.push({
      id: "customer-linked",
      title: t("projects.workspaceActivityCustomerLinkedTitle"),
      detail: t("projects.workspaceActivityCustomerLinkedDetail", { customer: getCustomerDisplayName(customer, t("customers.unnamedCustomer")) }),
      timestamp: formatDateTime(project.updated_at, localeTag),
      tone: "blue",
    });
  }

  const latestTask = tasks[0];
  if (latestTask) {
    items.push({
      id: `task-${latestTask.id}`,
      title: t("projects.workspaceActivityTaskTitle"),
      detail: latestTask.title,
      timestamp: formatDateTime(latestTask.updated_at || latestTask.created_at, localeTag),
      tone: "green",
      href: `/projects/${project.id}`,
    });
  }

  const latestInvoice = invoices[0];
  if (latestInvoice) {
    items.push({
      id: `invoice-${latestInvoice.id}`,
      title: t("projects.workspaceActivityInvoiceTitle"),
      detail: `${latestInvoice.invoice_number?.trim() || latestInvoice.title} · ${formatProjectCurrency(latestInvoice.total_amount - latestInvoice.amount_paid, localeTag, t("projects.notProvided"))}`,
      timestamp: formatDateTime(latestInvoice.updated_at || latestInvoice.created_at, localeTag),
      tone: "amber",
      href: `/projects/${project.id}`,
    });
  }

  const assignedManagers = Object.values(profilesById).slice(0, 1);
  if (assignedManagers.length > 0) {
    items.push({
      id: "manager",
      title: t("projects.workspaceActivityManagerTitle"),
      detail: assignedManagers[0],
      timestamp: formatDateTime(project.updated_at, localeTag),
      tone: "slate",
    });
  }

  return items;
}

function buildUpcomingSchedule(
  projectId: string,
  tasks: TaskSummary[],
  localeTag: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return tasks
    .filter((task) => Boolean(task.planned_start || task.planned_finish))
    .slice(0, 5)
    .map((task) => ({
      id: task.id,
      title: task.title,
      dateLabel: task.planned_finish ? formatProjectDateLong(task.planned_finish, localeTag, t("projects.notProvided")) : formatProjectDateLong(task.planned_start, localeTag, t("projects.notProvided")),
      detail: task.assigned_profile_id ? t("projects.workspaceAssignedTo", { name: task.assigned_profile_id }) : t("projects.notAssigned"),
      tone: getTaskTone(task),
      href: `/projects/${projectId}`,
    }));
}

function buildMilestones(project: ProjectSummary, tasks: TaskSummary[], localeTag: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const items: WorkspaceMilestoneItem[] = [];

  if (project.estimated_start_date) {
    items.push({
      id: "project-start",
      title: t("projects.workspaceMilestoneProjectStart"),
      detail: t("projects.workspaceMilestoneProjectStartDetail"),
      dateLabel: formatProjectDateLong(project.estimated_start_date, localeTag, t("projects.notProvided")),
      tone: "indigo",
    });
  }

  if (project.estimated_end_date) {
    items.push({
      id: "project-end",
      title: t("projects.workspaceMilestoneProjectEnd"),
      detail: t("projects.workspaceMilestoneProjectEndDetail"),
      dateLabel: formatProjectDateLong(project.estimated_end_date, localeTag, t("projects.notProvided")),
      tone: "blue",
    });
  }

  tasks
    .filter((task) => Boolean(task.planned_finish))
    .slice(0, 3)
    .forEach((task, index) => {
      items.push({
        id: task.id,
        title: task.title,
        detail: t("projects.workspaceMilestoneTaskDetail"),
        dateLabel: formatProjectDateLong(task.planned_finish, localeTag, t("projects.notProvided")),
        tone: index === 0 ? "green" : "amber",
      });
    });

  return items;
}

function buildOpenIssues(
  tasks: TaskSummary[],
  invoices: InvoiceSummary[],
  localeTag: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const overdueTasks = tasks.filter((task) => task.planned_finish && isPastDate(task.planned_finish) && task.status.trim().toLowerCase() !== "completed");
  const overdueInvoices = invoices.filter((invoice) => isInvoiceOutstanding(invoice.status, invoice.amount_paid, invoice.total_amount) && invoice.due_date && isPastDate(invoice.due_date));

  return [
    ...overdueTasks.map((task) => ({
      id: task.id,
      title: task.title,
      detail: t("projects.workspaceIssueTaskOverdue"),
      dateLabel: task.planned_finish ? formatProjectDateLong(task.planned_finish, localeTag, t("projects.notProvided")) : t("projects.notProvided"),
      tone: "amber" as const,
    })),
    ...overdueInvoices.map((invoice) => ({
      id: invoice.id,
      title: invoice.invoice_number?.trim() || invoice.title,
      detail: t("projects.workspaceIssueInvoiceOverdue"),
      dateLabel: invoice.due_date ? formatProjectDateLong(invoice.due_date, localeTag, t("projects.notProvided")) : t("projects.notProvided"),
      tone: "danger" as const,
    })),
  ];
}

function getTaskTone(task: TaskSummary): "blue" | "green" | "amber" | "indigo" | "slate" {
  const status = task.status.trim().toLowerCase();

  if (status === "completed") {
    return "green";
  }

  if (status === "in_progress") {
    return "blue";
  }

  if (status === "blocked" || status === "on_hold") {
    return "amber";
  }

  return "slate";
}

function getScheduleHealth(
  project: ProjectSummary,
  tasks: TaskSummary[],
  localeTag: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const progress = calculateProjectProgress(tasks);
  const overdueTasks = tasks.filter((task) => task.planned_finish && isPastDate(task.planned_finish) && task.status.trim().toLowerCase() !== "completed").length;
  const dueSoon = tasks.filter((task) => task.planned_finish && isWithinDays(task.planned_finish, 14) && task.status.trim().toLowerCase() !== "completed").length;
  const projectOverdue = Boolean(project.estimated_end_date && isPastDate(project.estimated_end_date) && progress < 100);

  if (projectOverdue || overdueTasks > 0) {
    return {
      label: t("projects.workspaceHealthBehindSchedule"),
      tone: "danger" as const,
      description: t("projects.workspaceHealthBehindScheduleDescription", { count: Math.max(overdueTasks, projectOverdue ? 1 : 0) }),
      score: 35,
    };
  }

  if (dueSoon > 0 || progress < 70) {
    return {
      label: t("projects.workspaceHealthAtRisk"),
      tone: "warning" as const,
      description: t("projects.workspaceHealthAtRiskDescription", { count: dueSoon }),
      score: 68,
    };
  }

  return {
    label: t("projects.workspaceHealthOnTrack"),
    tone: "success" as const,
    description: t("projects.workspaceHealthOnTrackDescription"),
    score: 92,
  };
}

function getBudgetHealth(project: ProjectSummary, localeTag: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const contractAmount = project.contract_amount ?? null;
  const estimatedCost = project.estimated_cost ?? null;

  if (typeof contractAmount !== "number") {
    return {
      label: t("projects.workspaceHealthBudgetPending"),
      tone: "neutral" as const,
      description: t("projects.workspaceHealthBudgetPendingDescription"),
      score: 62,
    };
  }

  const delta = contractAmount - (estimatedCost ?? 0);

  if (delta >= 0) {
    return {
      label: t("projects.workspaceHealthWithinBudget"),
      tone: "success" as const,
      description: t("projects.workspaceHealthWithinBudgetDescription", { amount: formatProjectCurrency(delta, localeTag, t("projects.notProvided")) }),
      score: 88,
    };
  }

  return {
    label: t("projects.workspaceHealthOverBudget"),
    tone: "warning" as const,
    description: t("projects.workspaceHealthOverBudgetDescription", { amount: formatProjectCurrency(Math.abs(delta), localeTag, t("projects.notProvided")) }),
    score: 54,
  };
}

function getSafetyHealth(t: (key: string, params?: Record<string, string | number>) => string) {
  return {
    label: t("projects.workspaceHealthSafetyClear"),
    tone: "success" as const,
    description: t("projects.workspaceHealthSafetyClearDescription"),
    score: 94,
  };
}

function getProgressHealth(progress: number, t: (key: string, params?: Record<string, string | number>) => string) {
  if (progress >= 80) {
    return {
      label: t("projects.workspaceHealthProgressStrong"),
      tone: "success" as const,
      description: t("projects.workspaceHealthProgressStrongDescription"),
      score: 90,
    };
  }

  if (progress >= 50) {
    return {
      label: t("projects.workspaceHealthProgressModerate"),
      tone: "warning" as const,
      description: t("projects.workspaceHealthProgressModerateDescription"),
      score: 70,
    };
  }

  return {
    label: t("projects.workspaceHealthProgressEarly"),
    tone: "neutral" as const,
    description: t("projects.workspaceHealthProgressEarlyDescription"),
    score: 58,
  };
}

function getOverallHealth(scores: number[], t: (key: string, params?: Record<string, string | number>) => string) {
  const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1));

  if (average >= 85) {
    return t("projects.workspaceHealthOverallStrong", { score: average });
  }

  if (average >= 70) {
    return t("projects.workspaceHealthOverallWatch", { score: average });
  }

  return t("projects.workspaceHealthOverallRisk", { score: average });
}

function calculateProjectProgress(tasks: TaskSummary[]) {
  if (tasks.length === 0) {
    return 0;
  }

  const completion = tasks.reduce((sum, task) => {
    if (task.status.trim().toLowerCase() === "completed") {
      return sum + 100;
    }

    return sum + Math.max(0, Math.min(100, task.completion_percentage));
  }, 0);

  return Math.round(completion / tasks.length);
}

function calculateProfit(contractAmount: number | null, estimatedCost: number | null) {
  if (typeof contractAmount !== "number") {
    return null;
  }

  const costs = typeof estimatedCost === "number" ? estimatedCost : 0;
  return contractAmount - costs;
}

function isInvoiceOutstanding(status: string, amountPaid: number, totalAmount: number) {
  const normalized = status.trim().toLowerCase();
  return normalized !== "paid" && Math.max(0, totalAmount - amountPaid) > 0;
}

function isPastDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() < Date.now() - 24 * 60 * 60 * 1000;
}

function isWithinDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const upper = new Date(now);
  upper.setDate(now.getDate() + days);

  return date.getTime() <= upper.getTime();
}

function formatDateTime(value: string, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getWorkspaceTabLabelKey(tab: WorkspaceTab) {
  const map: Record<WorkspaceTab, string> = {
    overview: "projects.workspaceTabOverview",
    daily_reports: "projects.workspaceTabDailyReports",
    scheduling: "projects.workspaceTabScheduling",
    crew: "projects.workspaceTabCrew",
    equipment: "projects.workspaceTabEquipment",
    safety: "projects.workspaceTabSafety",
    plans: "projects.workspaceTabPlans",
    financials: "projects.workspaceTabFinancials",
    ai_insights: "projects.workspaceTabAiInsights",
  };

  return map[tab];
}

async function shareWorkspace(projectId: string, t: (key: string, params?: Record<string, string | number>) => string) {
  if (typeof window === "undefined") {
    return;
  }

  const url = `${window.location.origin}/projects/${projectId}`;

  try {
    if (navigator.share) {
      await navigator.share({ title: t("projects.pageTitle"), url });
      return;
    }

    await navigator.clipboard.writeText(url);
  } catch {
    await navigator.clipboard.writeText(url).catch(() => undefined);
  }
}
