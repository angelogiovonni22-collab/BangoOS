"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  SummaryCard,
} from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext, type WorkspaceContext } from "@/lib/supabase/workspace";
import {
  formatProjectAddress,
  formatProjectCurrency,
  formatProjectDateLong,
  getProjectDisplayName,
  normalizeProjectStatus,
  type ProjectRow,
} from "@/lib/projects";
import { getProjectStatusBadgeClass } from "@/lib/projects/statuses";
import type { Database } from "@/types/database.types";
import { useI18n } from "@/lib/i18n/provider";
import { SiteCamWorkspace } from "./components/sitecam-workspace";

type ProjectSummary = Pick<
  ProjectRow,
  | "id"
  | "name"
  | "project_number"
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
>;

type CustomerSummary = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "first_name" | "last_name" | "company_name" | "customer_type"
>;

type ProfileSummary = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name"
>;

type TaskSummary = Pick<
  Database["public"]["Tables"]["tasks"]["Row"],
  "id" | "title" | "status" | "completion_percentage" | "planned_start" | "planned_finish" | "assigned_profile_id" | "created_at"
>;

type ProjectTab = "overview" | "photos" | "schedule" | "files" | "financial" | "activity";

type ProjectFileItem = {
  id: string;
  name: string;
  typeKey:
    | "fileTypeContracts"
    | "fileTypePermits"
    | "fileTypeDrawings"
    | "fileTypeSpecifications"
    | "fileTypeChangeOrders"
    | "fileTypeInvoices";
  uploadedAt: string;
};

type ActivityItem = {
  id: string;
  eventKey:
    | "activityProjectCreated"
    | "activityPhotoUploaded"
    | "activityEstimateApproved"
    | "activityCrewAssigned"
    | "activityFileUploaded";
  detailsKey:
    | "activityProjectCreatedDetails"
    | "activityPhotoUploadedDetails"
    | "activityEstimateApprovedDetails"
    | "activityCrewAssignedDetails"
    | "activityFileUploadedDetails";
  timestampKey:
    | "time2DaysAgo"
    | "time1DayAgo"
    | "time18HoursAgo"
    | "time9HoursAgo"
    | "time3HoursAgo";
};

const projectFiles: ProjectFileItem[] = [
  { id: "f-1", name: "Owner Contract v2.pdf", typeKey: "fileTypeContracts", uploadedAt: "2026-07-09" },
  { id: "f-2", name: "Permit - Electrical 4102.pdf", typeKey: "fileTypePermits", uploadedAt: "2026-07-11" },
  { id: "f-3", name: "Sheet A-102 Floorplan.dwg", typeKey: "fileTypeDrawings", uploadedAt: "2026-07-13" },
  { id: "f-4", name: "Finish Specifications.docx", typeKey: "fileTypeSpecifications", uploadedAt: "2026-07-14" },
  { id: "f-5", name: "Change Order CO-003.pdf", typeKey: "fileTypeChangeOrders", uploadedAt: "2026-07-19" },
  { id: "f-6", name: "Invoice INV-1242.pdf", typeKey: "fileTypeInvoices", uploadedAt: "2026-07-24" },
];

const activityFeed: ActivityItem[] = [
  {
    id: "a-1",
    eventKey: "activityProjectCreated",
    detailsKey: "activityProjectCreatedDetails",
    timestampKey: "time2DaysAgo",
  },
  {
    id: "a-2",
    eventKey: "activityPhotoUploaded",
    detailsKey: "activityPhotoUploadedDetails",
    timestampKey: "time1DayAgo",
  },
  {
    id: "a-3",
    eventKey: "activityEstimateApproved",
    detailsKey: "activityEstimateApprovedDetails",
    timestampKey: "time18HoursAgo",
  },
  {
    id: "a-4",
    eventKey: "activityCrewAssigned",
    detailsKey: "activityCrewAssignedDetails",
    timestampKey: "time9HoursAgo",
  },
  {
    id: "a-5",
    eventKey: "activityFileUploaded",
    detailsKey: "activityFileUploadedDetails",
    timestampKey: "time3HoursAgo",
  },
];

export default function ProjectDetailsPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const supabase = useMemo(() => createClient(), []);

  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [workspaceContext, setWorkspaceContext] = useState<WorkspaceContext | null>(null);

  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, string>>({});
  const [tasks, setTasks] = useState<TaskSummary[]>([]);

  useEffect(() => {
    let isSubscribed = true;

    const loadProject = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!projectId) {
        if (isSubscribed) {
          setErrorMessage(t("projects.errorReadProjectId"));
          setIsLoading(false);
        }

        return;
      }

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage || t("projects.errorLoadWorkspace"));
          setWorkspaceContext(null);
          setIsLoading(false);
        }

        return;
      }

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorMessage(t("projects.errorConnect"));
          setWorkspaceContext(null);
          setIsLoading(false);
        }

        return;
      }

      try {
        const [projectResponse, profilesResponse, tasksResponse] = await Promise.all([
          client
            .from("projects")
            .select(
              "id, name, project_number, status, customer_id, created_by, address_line_1, address_line_2, city, state, postal_code, estimated_cost, contract_amount, estimated_start_date, estimated_end_date, actual_end_date, created_at",
            )
            .eq("id", projectId)
            .eq("company_id", workspace.context.companyId)
            .maybeSingle<ProjectSummary>(),
          client
            .from("profiles")
            .select("id, first_name, last_name")
            .eq("company_id", workspace.context.companyId),
          client
            .from("tasks")
            .select("id, title, status, completion_percentage, planned_start, planned_finish, assigned_profile_id, created_at")
            .eq("company_id", workspace.context.companyId)
            .eq("project_id", projectId)
            .order("planned_start", { ascending: true })
            .order("created_at", { ascending: true }),
        ]);

        if (projectResponse.error) {
          if (isSubscribed) {
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

        if (profilesResponse.error) {
          if (isSubscribed) {
            setErrorMessage(t("projects.errorLoadTeamProfiles"));
          }

          return;
        }

        if (tasksResponse.error) {
          if (isSubscribed) {
            setErrorMessage(t("projects.errorLoadSchedule"));
          }

          return;
        }

        const loadedProject = projectResponse.data;
        const profileMap = buildProfileNameMap((profilesResponse.data ?? []) as ProfileSummary[], t("projects.notAssigned"));

        const customerResponse = loadedProject.customer_id
          ? await client
              .from("customers")
              .select("id, first_name, last_name, company_name, customer_type")
              .eq("company_id", workspace.context.companyId)
              .eq("id", loadedProject.customer_id)
              .maybeSingle<CustomerSummary>()
          : null;

        if (customerResponse?.error) {
          if (isSubscribed) {
            setErrorMessage(t("projects.errorLoadProjectCustomer"));
          }

          return;
        }

        if (isSubscribed) {
          setWorkspaceContext(workspace.context);
          setProject(loadedProject);
          setCustomer(customerResponse?.data ?? null);
          setProfilesById(profileMap);
          setTasks((tasksResponse.data ?? []) as TaskSummary[]);
        }
      } catch (caughtError) {
        console.error("Load project details error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(t("projects.errorUnexpectedWorkspace"));
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadProject();

    return () => {
      isSubscribed = false;
    };
  }, [projectId, supabase, t]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="h-10 w-56 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]" />
            <div className="h-6 w-80 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorMessage && !project) {
    return <ErrorState title={t("projects.errorTitle")} description={errorMessage} />;
  }

  if (notFound || !project) {
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

  const progress = calculateProjectProgress(tasks);
  const status = normalizeProjectStatus(project.status);
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const statusLabel = getProjectStatusLabel(status.key, t);
  const customerName = customer
    ? getCustomerDisplayName(customer, t("customers.unnamedCustomer"))
    : t("projects.notLinked");
  const projectManager = project.created_by ? profilesById[project.created_by] || t("projects.notAssigned") : t("projects.notAssigned");
  const assignedCrew = getAssignedCrewLabel(tasks, profilesById, t("projects.notAssigned"));
  const budget = formatProjectCurrency(project.contract_amount, localeTag, t("projects.notProvided"));
  const currentCosts = formatProjectCurrency(project.estimated_cost, localeTag, t("projects.notProvided"));
  const estimatedProfit = formatProjectCurrency(
    calculateProfit(project.contract_amount, project.estimated_cost),
    localeTag,
    t("projects.notProvided"),
  );
  const zeroAmount = formatProjectCurrency(0, localeTag, t("projects.notProvided"));

  const tabItems: Array<{ value: ProjectTab; label: string }> = [
    { value: "overview", label: t("projects.tabsOverview") },
    { value: "photos", label: t("projects.tabsPhotos") },
    { value: "schedule", label: t("projects.tabsSchedule") },
    { value: "files", label: t("projects.tabsFiles") },
    { value: "financial", label: t("projects.tabsFinancial") },
    { value: "activity", label: t("projects.tabsActivity") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject"))}
        description={`${t("projects.projectNumber")} ${project.project_number?.trim() || t("projects.notProvided")}`}
        secondaryActions={
          <Link href="/projects">
            <Button variant="outline">{t("projects.backToProjects")}</Button>
          </Link>
        }
      />

      {errorMessage ? <ErrorState compact title={t("projects.errorTitle")} description={errorMessage} /> : null}

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {tabItems.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-[var(--radius-lg)] border px-3 py-2 text-sm font-semibold transition ${
                  activeTab === tab.value
                    ? "border-[var(--color-brand-600)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                    : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                }`}
                aria-pressed={activeTab === tab.value}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {activeTab === "overview" ? (
        <OverviewTab
          customerName={customerName}
          address={formatProjectAddress(project as ProjectRow) || t("projects.notProvided")}
          projectManager={projectManager}
          assignedCrew={assignedCrew}
          budget={budget}
          estimatedProfit={estimatedProfit}
          startDate={formatProjectDateLong(project.estimated_start_date, localeTag, t("projects.notProvided"))}
          completionDate={formatProjectDateLong(
            project.actual_end_date || project.estimated_end_date,
            localeTag,
            t("projects.notProvided"),
          )}
          progress={progress}
          statusKey={status.key}
          statusLabel={statusLabel}
        />
      ) : null}

      {activeTab === "photos"
        ? workspaceContext
          ? (
            <SiteCamWorkspace
              companyId={workspaceContext.companyId}
              projectId={project.id}
              projectName={getProjectDisplayName(project as ProjectRow, t("projects.unnamedProject"))}
              userId={workspaceContext.userId}
              locale={locale}
              profilesById={profilesById}
            />
            )
          : <ErrorState compact title={t("projects.sitecamLoadErrorTitle")} description={t("projects.errorLoadWorkspace")} />
        : null}
      {activeTab === "schedule" ? <ScheduleTab tasks={tasks} profilesById={profilesById} localeTag={localeTag} /> : null}
      {activeTab === "files" ? <FilesTab files={projectFiles} localeTag={localeTag} /> : null}
      {activeTab === "financial" ? <FinancialTab budget={budget} currentCosts={currentCosts} estimatedProfit={estimatedProfit} zeroAmount={zeroAmount} /> : null}
      {activeTab === "activity" ? <ActivityTab items={activityFeed} /> : null}
    </div>
  );
}

function OverviewTab({
  customerName,
  address,
  projectManager,
  assignedCrew,
  budget,
  estimatedProfit,
  startDate,
  completionDate,
  progress,
  statusKey,
  statusLabel,
}: {
  customerName: string;
  address: string;
  projectManager: string;
  assignedCrew: string;
  budget: string;
  estimatedProfit: string;
  startDate: string;
  completionDate: string;
  progress: number;
  statusKey: string;
  statusLabel: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <SectionHeader title={t("projects.overviewTitle")} description={t("projects.overviewDescription")} />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <OverviewField label={t("projects.fieldCustomer")} value={customerName} />
            <OverviewField label={t("projects.fieldAddress")} value={address} />
            <OverviewField label={t("projects.fieldProjectManager")} value={projectManager} />
            <OverviewField label={t("projects.fieldAssignedCrew")} value={assignedCrew} />
            <OverviewField label={t("projects.fieldBudget")} value={budget} />
            <OverviewField label={t("projects.fieldEstimatedProfit")} value={estimatedProfit} />
            <OverviewField label={t("projects.fieldStartDate")} value={startDate} />
            <OverviewField label={t("projects.fieldCompletionDate")} value={completionDate} />
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                {t("projects.fieldCurrentStatus")}
              </p>
              <div className="mt-2">
                <Badge className={getProjectStatusBadgeClass(statusKey)}>{statusLabel}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t("projects.fieldProgress")}</p>
          <p className="mt-2 text-3xl font-bold text-[var(--color-text-primary)]">{progress}%</p>
          <div className="mt-3 h-3 rounded-full bg-[var(--color-surface-muted)]">
            <div className="h-3 rounded-full bg-[var(--color-brand-600)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ScheduleTab({
  tasks,
  profilesById,
  localeTag,
}: {
  tasks: TaskSummary[];
  profilesById: Record<string, string>;
  localeTag: string;
}) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("projects.tabsSchedule")}</CardTitle>
        <CardDescription>{t("projects.overviewDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        {tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.slice(0, 12).map((task) => (
              <div key={task.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{task.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {task.planned_start
                        ? formatProjectDateLong(task.planned_start, localeTag, t("projects.notProvided"))
                        : t("projects.notProvided")}
                      {" - "}
                      {task.planned_finish
                        ? formatProjectDateLong(task.planned_finish, localeTag, t("projects.notProvided"))
                        : t("projects.notProvided")}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={getProjectStatusBadgeClass(normalizeProjectStatus(task.status).key)}>
                      {getProjectStatusLabel(normalizeProjectStatus(task.status).key, t)}
                    </Badge>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                      {task.assigned_profile_id ? profilesById[task.assigned_profile_id] || t("projects.notAssigned") : t("projects.notAssigned")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--color-surface-muted)]">
                  <div
                    className="h-2 rounded-full bg-[var(--color-brand-600)]"
                    style={{ width: `${Math.max(0, Math.min(100, task.completion_percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact icon="S" title={t("projects.tabsSchedule")} description={t("projects.scheduleEmptyDescription")} />
        )}
      </CardContent>
    </Card>
  );
}

function FilesTab({ files, localeTag }: { files: ProjectFileItem[]; localeTag: string }) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title={t("projects.filesTitle")}
          description={t("projects.filesDescription")}
          action={<Button>{t("projects.uploadFile")}</Button>}
        />
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        {files.map((file) => (
          <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] p-4">
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{file.name}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatProjectDateLong(file.uploadedAt, localeTag, t("projects.notProvided"))}</p>
            </div>
            <Badge tone="brand">{t(`projects.${file.typeKey}`)}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FinancialTab({
  budget,
  currentCosts,
  estimatedProfit,
  zeroAmount,
}: {
  budget: string;
  currentCosts: string;
  estimatedProfit: string;
  zeroAmount: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <SectionHeader title={t("projects.financialTitle")} description={t("projects.financialDescription")} />

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard icon="$" label={t("projects.financeEstimateTotal")} value={budget} />
        <SummaryCard icon="+" label={t("projects.financeApprovedChangeOrders")} value={zeroAmount} />
        <SummaryCard icon="P" label={t("projects.financeCustomerPayments")} value={zeroAmount} />
        <SummaryCard icon="C" label={t("projects.financeCurrentCosts")} value={currentCosts} />
        <SummaryCard icon="%" label={t("projects.financeEstimatedProfit")} value={estimatedProfit} />
      </section>
    </div>
  );
}

function ActivityTab({ items }: { items: ActivityItem[] }) {
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("projects.activityTitle")}</CardTitle>
        <CardDescription>{t("projects.activityDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <ol className="relative ml-2 border-l border-[var(--color-border-subtle)] pl-6">
          {items.map((item) => (
            <li key={item.id} className="mb-6 last:mb-0">
              <span className="absolute -left-[7px] mt-1.5 h-3.5 w-3.5 rounded-full bg-[var(--color-brand-600)]" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(`projects.${item.eventKey}`)}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t(`projects.${item.detailsKey}`)}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{t(`projects.${item.timestampKey}`)}</p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function OverviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 whitespace-pre-line text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function buildProfileNameMap(rows: ProfileSummary[], fallbackLabel: string) {
  return Object.fromEntries(
    rows.map((row) => {
      const fullName = `${row.first_name?.trim() || ""} ${row.last_name?.trim() || ""}`.trim();
      return [row.id, fullName || fallbackLabel] as const;
    }),
  );
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

function getAssignedCrewLabel(tasks: TaskSummary[], profilesById: Record<string, string>, fallback: string) {
  const assignedIds = Array.from(
    new Set(tasks.map((task) => task.assigned_profile_id).filter((profileId): profileId is string => Boolean(profileId))),
  );

  if (assignedIds.length === 0) {
    return fallback;
  }

  const names = assignedIds.map((id) => profilesById[id] || fallback).slice(0, 3);
  const remainder = assignedIds.length - names.length;

  if (remainder > 0) {
    return `${names.join(", ")} +${remainder}`;
  }

  return names.join(", ");
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
