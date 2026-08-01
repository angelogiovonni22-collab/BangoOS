"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { FadeIn, MotionProvider, PageTransition } from "@/components/motion";
import {
  ProjectKpiGrid,
  ProjectHealthHero,
  ProjectOverview,
  ProjectTabs,
  ProjectWorkWorkspace,
  ProjectWorkspaceHeader,
  ProjectWorkspaceModuleCard,
  calculateProjectHealth,
  type ProjectWorkspaceTabKey,
  type WorkspaceActivityItem,
  type WorkspaceMilestoneItem,
} from "@/components/projects/workspace";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, SkeletonLoader } from "@/components/ui";
import {
  formatProjectAddress,
  formatProjectCurrency,
  formatProjectDateLong,
  getProjectDisplayName,
  normalizeProjectStatus,
  type ProjectRow,
} from "@/lib/projects";
import { useI18n } from "@/lib/i18n/provider";
import { PROJECT_WORKSPACE_ASSIGNED_EQUIPMENT_STATUSES, PROJECT_WORKSPACE_EQUIPMENT_CONFLICT_OR_FILTER } from "@/lib/equipment";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";
import { calculateProjectIntelligence } from "@/lib/project-intelligence/calculate-project-intelligence";
import { generateProjectBriefing } from "@/lib/project-intelligence/briefing/generate-project-briefing";
import type { Database } from "@/types/database.types";

type ProjectSummary = Pick<
  ProjectRow,
  | "id"
  | "name"
  | "project_number"
  | "project_type"
  | "status"
  | "description"
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
  | "description"
  | "notes"
  | "status"
  | "priority"
  | "completion_percentage"
  | "phase_id"
  | "planned_start"
  | "planned_finish"
  | "actual_start"
  | "actual_finish"
  | "estimated_hours"
  | "actual_hours"
  | "assigned_profile_id"
  | "created_by"
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

type WorkspaceCounts = {
  estimates: number;
  changeOrders: number;
  photos: number;
  assignedEquipment: number;
  availableEquipment: number;
  equipmentConflicts: number;
};

type WorkspaceState = {
  project: ProjectSummary;
  customer: CustomerSummary | null;
  profilesById: Record<string, string>;
  tasks: TaskSummary[];
  invoices: InvoiceSummary[];
  counts: WorkspaceCounts;
  workspaceContext: WorkspaceContext;
};

type WorkspaceErrorKind = "auth" | "company" | "database" | "network" | "unknown";

type WorkspaceTab = ProjectWorkspaceTabKey;

export default function ProjectWorkspacePage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id?: string | string[] }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const supabase = useMemo(() => createClient(), []);

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
            "id, name, project_number, project_type, status, description, customer_id, created_by, address_line_1, address_line_2, city, state, postal_code, estimated_cost, contract_amount, estimated_start_date, estimated_end_date, actual_end_date, created_at, updated_at",
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

        const [profilesResponse, tasksResponse, invoicesResponse, customerResponse, estimatesCountResponse, changeOrdersCountResponse, photosCountResponse, assignedEquipmentCountResponse, availableEquipmentCountResponse, equipmentConflictCountResponse] = await Promise.all([
          client
            .from("profiles")
            .select("id, first_name, last_name, role")
            .eq("company_id", workspaceResult.context.companyId),
          client
            .from("tasks")
            .select("id, title, description, notes, status, priority, completion_percentage, phase_id, planned_start, planned_finish, actual_start, actual_finish, estimated_hours, actual_hours, assigned_profile_id, created_by, created_at, updated_at")
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
          client
            .from("estimates")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId),
          client
            .from("change_orders")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId),
          client
            .from("project_photos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId),
          client
            .from("equipment")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("assigned_job_id", projectId)
            .in("status", [...PROJECT_WORKSPACE_ASSIGNED_EQUIPMENT_STATUSES]),
          client
            .from("equipment")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("status", "active")
            .is("assigned_job_id", null),
          client
            .from("equipment")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("assigned_job_id", projectId)
            .or(PROJECT_WORKSPACE_EQUIPMENT_CONFLICT_OR_FILTER),
        ]);

        if (profilesResponse.error || tasksResponse.error || invoicesResponse.error || customerResponse.error || estimatesCountResponse.error || changeOrdersCountResponse.error || photosCountResponse.error || assignedEquipmentCountResponse.error || availableEquipmentCountResponse.error || equipmentConflictCountResponse.error) {
          if (isSubscribed) {
            setErrorKind("database");
            setErrorMessage(t("projects.errorLoadProject"));
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
            counts: {
              estimates: estimatesCountResponse.count || 0,
              changeOrders: changeOrdersCountResponse.count || 0,
              photos: photosCountResponse.count || 0,
              assignedEquipment: assignedEquipmentCountResponse.count || 0,
              availableEquipment: availableEquipmentCountResponse.count || 0,
              equipmentConflicts: equipmentConflictCountResponse.count || 0,
            },
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
  }, [projectId, supabase, t]);

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
  const projectName = getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject"));
  const customerName = workspace.customer ? getCustomerDisplayName(workspace.customer, t("customers.unnamedCustomer")) : t("projects.notLinked");
  const customerHref = workspace.customer?.id ? `/customers/${workspace.customer.id}` : null;
  const customerProjectsHref = workspace.customer?.id ? `/customers/${workspace.customer.id}?tab=projects` : "/projects";
  const projectManager = workspace.project.created_by ? workspace.profilesById[workspace.project.created_by] || t("projects.notAssigned") : t("projects.notAssigned");
  const location = formatProjectAddress(project as ProjectRow) || t("projects.notProvided");
  const status = normalizeProjectStatus(project.status);
  const statusLabel = getProjectStatusLabel(status.key, t);
  const startDate = formatProjectDateLong(project.estimated_start_date, localeTag, t("projects.notProvided"));
  const completionDate = formatProjectDateLong(project.actual_end_date || project.estimated_end_date, localeTag, t("projects.notProvided"));
  const progress = calculateProjectProgress(workspace.tasks);

  const budgetValueRaw = project.contract_amount ?? project.estimated_cost;
  const spentValueRaw = workspace.invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount_paid), 0);
  const remainingValueRaw = typeof budgetValueRaw === "number" ? budgetValueRaw - spentValueRaw : null;

  const budgetValue = formatProjectCurrency(budgetValueRaw, localeTag, t("projects.notProvided"));
  const spentValue = formatProjectCurrency(spentValueRaw, localeTag, "$0");
  const remainingValue = formatProjectCurrency(remainingValueRaw, localeTag, t("projects.notProvided"));
  const profitMarginValue = formatProfitMargin(budgetValueRaw, spentValueRaw);

  const projectHealth = calculateProjectHealth({
    projectStatus: project.status,
    progressPercent: progress,
    targetCompletionDate: project.estimated_end_date,
    budget: budgetValueRaw,
    spent: spentValueRaw,
  });

  const projectIntelligence = calculateProjectIntelligence({
    project: {
      status: project.status,
      estimated_end_date: project.estimated_end_date,
      contract_amount: project.contract_amount ?? null,
      estimated_cost: project.estimated_cost ?? null,
      description: project.description ?? null,
    },
    tasks: workspace.tasks.map((t) => ({
      id: t.id,
      status: t.status,
      completion_percentage: t.completion_percentage,
      planned_finish: t.planned_finish ?? null,
      assigned_profile_id: t.assigned_profile_id ?? null,
      phase_id: t.phase_id ?? null,
    })),
    invoices: workspace.invoices.map((inv) => ({
      total_amount: inv.total_amount,
      amount_paid: inv.amount_paid,
      due_date: inv.due_date ?? null,
    })),
    counts: workspace.counts,
  });

  const projectBriefing = generateProjectBriefing({
    intelligence: projectIntelligence,
    projectId: project.id,
    projectName,
    localeTag,
  });

  const briefingFormatCurrency = (amount: number) =>
    formatProjectCurrency(amount, localeTag, "$0");

  const recentActivity = buildRecentActivity({
    project,
    customer: workspace.customer,
    tasks: workspace.tasks,
    invoices: workspace.invoices,
    profilesById: workspace.profilesById,
    localeTag,
    t,
  });

  const upcomingDates = buildUpcomingDates(project, workspace.tasks, localeTag, t);
  const timeline = buildTimeline(recentActivity, upcomingDates);

  const headerProjectHrefSuffix = project.customer_id ? `&customerId=${project.customer_id}` : "";
  const details = [
    { label: "Customer", value: customerName, href: customerHref || undefined },
    { label: "Address", value: location },
    { label: "Project Type", value: project.project_type || t("projects.notProvided") },
    { label: "Status", value: statusLabel, badgeTone: mapStatusToBadgeTone(status.key) },
    { label: "Start Date", value: startDate },
    { label: "Target Completion", value: completionDate },
    { label: "Project Manager", value: projectManager },
    { label: "Created", value: formatProjectDateLong(project.created_at, localeTag, t("projects.notProvided")) },
  ];

  return (
    <MotionProvider>
      <div className="space-y-6">
        <FadeIn delayMs={0} distancePx={4}>
          <ProjectWorkspaceHeader
            projectName={projectName}
            customerName={customerName}
            customerHref={customerHref}
            customerProjectsHref={customerProjectsHref}
            statusLabel={statusLabel}
            statusKey={status.key}
            projectTypeLabel={project.project_type || t("projects.notProvided")}
            projectNumber={project.project_number}
            address={location}
            projectManager={projectManager}
            startDate={startDate}
            targetCompletionDate={completionDate}
            progressPercent={progress}
            newDailyReportHref="/daily-reports/new"
            newInvoiceHref={`/invoices/new?projectId=${project.id}${headerProjectHrefSuffix}`}
            newChangeOrderHref={`/change-orders/new?projectId=${project.id}${headerProjectHrefSuffix}`}
          />
        </FadeIn>

        <FadeIn delayMs={50} distancePx={6}>
          <ProjectHealthHero health={projectHealth} />
        </FadeIn>

        <FadeIn delayMs={90} distancePx={6}>
          <ProjectKpiGrid
            budgetLabel={budgetValue}
            spentLabel={spentValue}
            remainingLabel={remainingValue}
            profitMarginLabel={profitMarginValue}
          />
        </FadeIn>

        <FadeIn delayMs={130} distancePx={4}>
          <ProjectTabs activeTab={activeTab} onChange={handleTabChange} t={t} />
        </FadeIn>

        <PageTransition transitionKey={`workspace-tab-${activeTab}`}>
          {activeTab === "overview" ? (
            <div className="space-y-6">
              <ProjectOverview
                details={details}
                description={project.description?.trim() || "No project scope description has been provided yet."}
                health={projectHealth}
                budgetLabel={budgetValue}
                spentLabel={spentValue}
                remainingLabel={remainingValue}
                profitMarginLabel={profitMarginValue}
                recentActivity={recentActivity}
                upcomingDates={upcomingDates}
              />
            </div>
          ) : activeTab === "work" ? (
            <ProjectWorkWorkspace
              companyId={workspace.workspaceContext.companyId}
              projectId={project.id}
              projectName={projectName}
              projectStatus={project.status}
              customerId={workspace.customer?.id ?? null}
              userId={workspace.workspaceContext.userId}
              locale={localeTag}
              tasks={workspace.tasks}
              profiles={workspace.profilesById}
              briefing={projectBriefing}
              formatCurrency={briefingFormatCurrency}
              t={t}
            />
          ) : activeTab === "financial" ? (
        <ModuleGrid>
          <ProjectWorkspaceModuleCard
            title="Budget"
            description="Review baseline budget and monitor remaining financial runway."
            metricLabel="Remaining"
            metricValue={remainingValue}
          />
          <ProjectWorkspaceModuleCard
            title="Estimates"
            description="Review estimate history connected to this project."
            metricLabel="Records"
            metricValue={String(workspace.counts.estimates)}
            href="/estimates"
            actionLabel="Open Estimates"
          />
          <ProjectWorkspaceModuleCard
            title="Change Orders"
            description="Track approved and pending change scope impacting budget and delivery."
            metricLabel="Records"
            metricValue={String(workspace.counts.changeOrders)}
            href={`/change-orders?projectId=${project.id}`}
            actionLabel="Open Change Orders"
          />
          <ProjectWorkspaceModuleCard
            title="Invoices"
            description="Track billing progress and paid amount recorded to date."
            metricLabel="Records"
            metricValue={String(workspace.invoices.length)}
            href={`/invoices?projectId=${project.id}`}
            actionLabel="Open Invoices"
          />
          <ProjectWorkspaceModuleCard
            title="Job Costing"
            description="Detailed job costing will appear here as cost categories are connected beyond paid invoice data."
          />
        </ModuleGrid>
          ) : activeTab === "resources" ? (
        <ModuleGrid>
          <ProjectWorkspaceModuleCard
            title="Crew"
            description="View crew allocation and team availability for this project."
            href="/crews"
            actionLabel="Open Crew"
          />
          <ProjectWorkspaceModuleCard
            title="Equipment"
            description="Track assigned equipment and availability across active jobs."
            metricLabel="Assigned / Available / Conflicts"
            metricValue={`${workspace.counts.assignedEquipment} / ${workspace.counts.availableEquipment} / ${workspace.counts.equipmentConflicts}`}
            href="/equipment"
            actionLabel="Open Equipment"
          />
          <ProjectWorkspaceModuleCard
            title="Materials"
            description="Manage material supply and project-specific usage details."
            href="/materials"
            actionLabel="Open Materials"
          />
          <ProjectWorkspaceModuleCard
            title="Vendors"
            description="Manage vendor and subcontractor partners supporting project delivery."
            href="/vendors"
            actionLabel="Open Vendors"
          />
        </ModuleGrid>
          ) : activeTab === "documents" ? (
        <ModuleGrid>
          <ProjectWorkspaceModuleCard
            title="Photos"
            description="Field photos uploaded to this project are tracked here."
            metricLabel="Uploaded"
            metricValue={String(workspace.counts.photos)}
          />
          <ProjectWorkspaceModuleCard
            title="Files"
            description="Project file storage will appear here when document records are available."
          />
          <ProjectWorkspaceModuleCard
            title="Contracts"
            description="Contract records and signed artifacts will appear here once connected."
          />
          <ProjectWorkspaceModuleCard
            title="Drawings"
            description="Plan and drawing workflows are available in the plans workspace."
            href={`/projects/${project.id}?tab=plans`}
            actionLabel="Open Plans"
          />
          <ProjectWorkspaceModuleCard
            title="Permits"
            description="Permit tracking will appear here when permitting records are available."
          />
        </ModuleGrid>
          ) : (
        <Card as="section" variant="elevated" className="shadow-[var(--shadow-small)]">
          <CardHeader className="bg-[var(--color-surface-subtle)]/45">
            <CardTitle>Project Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {timeline.length === 0 ? (
              <EmptyState
                compact
                icon="T"
                title="No timeline events"
                description="Timeline events will appear here as project activity is recorded."
              />
            ) : (
              timeline.map((item) => (
                <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.detail}</p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">{item.timestamp}</p>
                </article>
              ))
            )}
          </CardContent>
        </Card>
          )}
        </PageTransition>
      </div>
    </MotionProvider>
  );
}

function ModuleGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-2">{children}</div>;
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
      <SkeletonLoader className="h-56 w-full" />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
        <SkeletonLoader className="h-32 w-full" />
      </section>
      <SkeletonLoader className="h-14 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonLoader className="h-72 w-full" />
        <SkeletonLoader className="h-72 w-full" />
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
  const validTabs: WorkspaceTab[] = ["overview", "work", "financial", "resources", "documents", "timeline"];

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

function mapStatusToBadgeTone(statusKey: string): "brand" | "success" | "warning" | "danger" | "neutral" {
  if (statusKey === "completed") {
    return "success";
  }

  if (statusKey === "cancelled") {
    return "danger";
  }

  if (statusKey === "on_hold") {
    return "warning";
  }

  if (statusKey === "lead") {
    return "neutral";
  }

  return "brand";
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

function formatProfitMargin(budget: number | null, spent: number) {
  if (typeof budget !== "number" || budget <= 0) {
    return "-";
  }

  const margin = ((budget - spent) / budget) * 100;
  return `${margin.toFixed(1)}%`;
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

  const latestTask = tasks[tasks.length - 1];
  if (latestTask) {
    items.push({
      id: `task-${latestTask.id}`,
      title: t("projects.workspaceActivityTaskTitle"),
      detail: latestTask.title,
      timestamp: formatDateTime(latestTask.updated_at || latestTask.created_at, localeTag),
      tone: "green",
    });
  }

  const latestInvoice = invoices[0];
  if (latestInvoice) {
    items.push({
      id: `invoice-${latestInvoice.id}`,
      title: t("projects.workspaceActivityInvoiceTitle"),
      detail: latestInvoice.invoice_number?.trim() || latestInvoice.title,
      timestamp: formatDateTime(latestInvoice.updated_at || latestInvoice.created_at, localeTag),
      tone: "amber",
    });
  }

  const managerName = project.created_by ? profilesById[project.created_by] : null;
  if (managerName) {
    items.push({
      id: "manager",
      title: t("projects.workspaceActivityManagerTitle"),
      detail: managerName,
      timestamp: formatDateTime(project.updated_at, localeTag),
      tone: "slate",
    });
  }

  return items;
}

function buildUpcomingDates(
  project: ProjectSummary,
  tasks: TaskSummary[],
  localeTag: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): WorkspaceMilestoneItem[] {
  const dates: WorkspaceMilestoneItem[] = [];

  if (project.estimated_start_date) {
    dates.push({
      id: "project-start",
      title: "Planned Start",
      detail: "Project baseline start date",
      dateLabel: formatProjectDateLong(project.estimated_start_date, localeTag, t("projects.notProvided")),
      tone: "indigo",
    });
  }

  if (project.estimated_end_date) {
    dates.push({
      id: "project-end",
      title: "Target Completion",
      detail: "Current completion target",
      dateLabel: formatProjectDateLong(project.estimated_end_date, localeTag, t("projects.notProvided")),
      tone: "blue",
    });
  }

  tasks
    .filter((task) => Boolean(task.planned_finish))
    .slice(0, 4)
    .forEach((task) => {
      dates.push({
        id: `task-${task.id}`,
        title: task.title,
        detail: "Planned task finish",
        dateLabel: formatProjectDateLong(task.planned_finish, localeTag, t("projects.notProvided")),
        tone: "amber",
      });
    });

  return dates;
}

function buildTimeline(activity: WorkspaceActivityItem[], milestones: WorkspaceMilestoneItem[]) {
  const events = [
    ...activity.map((item) => ({
      id: `activity-${item.id}`,
      title: item.title,
      detail: item.detail,
      timestamp: item.timestamp,
    })),
    ...milestones.map((item) => ({
      id: `milestone-${item.id}`,
      title: item.title,
      detail: item.detail,
      timestamp: item.dateLabel,
    })),
  ];

  return events.slice(0, 12);
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
