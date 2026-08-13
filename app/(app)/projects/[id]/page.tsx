"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { FadeIn, MotionProvider, PageTransition } from "@/components/motion";
import {
  CommandCenterTimelineEntry,
  ProjectCommandCenterFoundation,
  ProjectComplianceWorkflow,
  ProjectCommandCenterTabPlaceholder,
  ProjectFinancialReporting,
  ProjectExecutionCalendarEvent,
  ProjectExecutionIssue,
  ProjectExecutionNote,
  ProjectExecutionTask,
  ProjectExecutionWorkspace,
  ProjectKpiGrid,
  ProjectTabs,
  ProjectTradePartnersWorkspace,
  ProjectWorkspaceHeader,
  ProjectWorkspaceHero,
  type ProjectWorkspaceTabKey,
  type WorkspaceActivityItem,
} from "@/components/projects/workspace";
import { SiteCamWorkspace } from "./components/sitecam-workspace";
import { PlansWorkspace } from "@/components/plans";
import { WorkspaceLoadingState, WorkspaceShell } from "@/components/workspace";
import { Button, EmptyState, ErrorState } from "@/components/ui";
import { buildProjectFinancialReport, type ProjectFinancialReport } from "@/lib/financial-reporting";
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

type ProjectCommunicationSummary = Pick<
  Database["public"]["Tables"]["project_communications"]["Row"],
  "id" | "channel" | "status" | "subject" | "created_at"
>;

type ProjectInspectionSummary = Pick<
  Database["public"]["Tables"]["project_inspections"]["Row"],
  "id" | "inspection_type" | "status" | "created_at" | "scheduled_at" | "completed_at"
>;

type ProjectPermitSummary = Pick<
  Database["public"]["Tables"]["project_permits"]["Row"],
  "id" | "permit_type" | "status" | "created_at"
>;

type ProjectPunchItemSummary = Pick<
  Database["public"]["Tables"]["project_punch_items"]["Row"],
  "id" | "title" | "status" | "created_at"
>;

type ProjectPunchItemDetailSummary = Pick<
  Database["public"]["Tables"]["project_punch_items"]["Row"],
  "id" | "title" | "status" | "priority" | "due_date" | "assigned_profile_id" | "updated_at" | "created_at"
>;

type WorkforceAssignmentSummary = Pick<
  Database["public"]["Tables"]["workforce_assignments"]["Row"],
  "id" | "title" | "status" | "starts_at" | "ends_at" | "crew_id" | "employee_id" | "task_id" | "updated_at"
>;

type CrewSummary = Pick<
  Database["public"]["Tables"]["crews"]["Row"],
  "id" | "name"
>;

type WorkflowDailyReportSummary = Pick<
  Database["public"]["Tables"]["workflow_events"]["Row"],
  "id" | "event_type" | "occurred_at" | "created_at" | "payload"
>;

type ProjectPhotoActivitySummary = Pick<
  Database["public"]["Tables"]["project_photos"]["Row"],
  "id" | "note" | "category" | "created_at"
>;

type ChangeOrderActivitySummary = Pick<
  Database["public"]["Tables"]["change_orders"]["Row"],
  "id" | "title" | "change_order_number" | "status" | "requested_date" | "created_at" | "updated_at"
>;

type WorkspaceCounts = {
  estimates: number;
  changeOrders: number;
  dailyReports: number;
  photos: number;
  inspections: number;
  pendingInspections: number;
  permits: number;
  openPermits: number;
  communications: number;
  openPunchItems: number;
  assignedEquipment: number;
  availableEquipment: number;
  equipmentConflicts: number;
};

type CloseoutSnapshot = {
  id: string;
  status: string;
  handoverStatus: string;
  finalPaymentRecorded: boolean;
  customerApprovalRecorded: boolean;
  requiredDocumentsCompleted: boolean;
  permitClosureCompleted: boolean;
  crewRemovalCompleted: boolean;
  equipmentReturnCompleted: boolean;
} | null;

type WorkspaceState = {
  project: ProjectSummary;
  customer: CustomerSummary | null;
  heroImageUrl: string | null;
  profilesById: Record<string, string>;
  tasks: TaskSummary[];
  invoices: InvoiceSummary[];
  counts: WorkspaceCounts;
  closeout: CloseoutSnapshot;
  timelineEntries: CommandCenterTimelineEntry[];
  punchItems: ProjectPunchItemDetailSummary[];
  assignments: WorkforceAssignmentSummary[];
  crews: CrewSummary[];
  dailyReportEvents: WorkflowDailyReportSummary[];
  photoEvents: ProjectPhotoActivitySummary[];
  changeOrderEvents: ChangeOrderActivitySummary[];
  communications: ProjectCommunicationSummary[];
  inspections: ProjectInspectionSummary[];
  financialReport: ProjectFinancialReport | null;
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
        const financialReportPromise = buildProjectFinancialReport({
          supabase: client,
          companyId: workspaceResult.context.companyId,
          projectId,
        });
        const timelineDb = client as unknown as {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          from: (table: string) => any;
        };
        const customerQuery = loadedProject.customer_id
          ? client
              .from("customers")
              .select("id, first_name, last_name, company_name, customer_type, email, phone")
              .eq("company_id", workspaceResult.context.companyId)
              .eq("id", loadedProject.customer_id)
              .maybeSingle<CustomerSummary>()
          : Promise.resolve({ data: null, error: null });

        const [profilesResponse, tasksResponse, invoicesResponse, customerResponse, estimatesCountResponse, changeOrdersCountResponse, dailyReportsCountResponse, photosCountResponse, latestProjectPhotoResponse, inspectionsCountResponse, pendingInspectionsCountResponse, permitsCountResponse, openPermitsCountResponse, communicationsCountResponse, openPunchItemsCountResponse, closeoutResponse, assignedEquipmentCountResponse, availableEquipmentCountResponse, equipmentConflictCountResponse, communicationsRecentResponse, inspectionsRecentResponse, permitsRecentResponse, punchItemsRecentResponse, punchItemsDetailResponse, assignmentsResponse, crewsResponse, dailyReportEventsResponse, photoEventsResponse, changeOrdersRecentResponse] = await Promise.all([
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
          timelineDb
            .from("workflow_events")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("reference_entity", "daily_report")
            .eq("event_type", "daily_report.created")
            .eq("payload->>project_id", projectId),
          client
            .from("project_photos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId),
          client
            .from("project_photos")
            .select("storage_path")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .not("storage_path", "is", null)
            .order("captured_at", { ascending: false, nullsFirst: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<{ storage_path: string | null }>(),
          timelineDb
            .from("project_inspections")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId),
          timelineDb
            .from("project_inspections")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .in("status", ["scheduled", "in_progress", "failed", "reinspection_required"]),
          timelineDb
            .from("project_permits")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId),
          timelineDb
            .from("project_permits")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .in("status", ["required", "preparing", "submitted", "under_review", "renewal_required", "expired", "rejected"]),
          timelineDb
            .from("project_communications")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId),
          timelineDb
            .from("project_punch_items")
            .select("id", { count: "exact", head: true })
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .in("status", ["open", "in_progress", "reopened"]),
          timelineDb
            .from("project_closeouts")
            .select("id, status, handover_status, final_payment_recorded, customer_approval_recorded, required_documents_completed, permit_closure_completed, crew_removal_completed, equipment_return_completed")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .maybeSingle(),
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
          timelineDb
            .from("project_communications")
            .select("id, channel, status, subject, created_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(6),
          timelineDb
            .from("project_inspections")
            .select("id, inspection_type, status, created_at, scheduled_at, completed_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(6),
          timelineDb
            .from("project_permits")
            .select("id, permit_type, status, created_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(6),
          timelineDb
            .from("project_punch_items")
            .select("id, title, status, created_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(6),
          timelineDb
            .from("project_punch_items")
            .select("id, title, status, priority, due_date, assigned_profile_id, updated_at, created_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("updated_at", { ascending: false })
            .limit(40),
          timelineDb
            .from("workforce_assignments")
            .select("id, title, status, starts_at, ends_at, crew_id, employee_id, task_id, updated_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("starts_at", { ascending: true })
            .limit(60),
          timelineDb
            .from("crews")
            .select("id, name")
            .eq("company_id", workspaceResult.context.companyId)
            .order("name", { ascending: true }),
          timelineDb
            .from("workflow_events")
            .select("id, event_type, occurred_at, created_at, payload")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("reference_entity", "daily_report")
            .eq("event_type", "daily_report.created")
            .eq("payload->>project_id", projectId)
            .order("occurred_at", { ascending: false })
            .limit(20),
          timelineDb
            .from("project_photos")
            .select("id, note, category, created_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(20),
          timelineDb
            .from("change_orders")
            .select("id, title, change_order_number, status, requested_date, created_at, updated_at")
            .eq("company_id", workspaceResult.context.companyId)
            .eq("project_id", projectId)
            .order("updated_at", { ascending: false })
            .limit(20),
        ]);

        if (profilesResponse.error || tasksResponse.error || invoicesResponse.error || customerResponse.error || estimatesCountResponse.error || changeOrdersCountResponse.error || dailyReportsCountResponse.error || photosCountResponse.error || latestProjectPhotoResponse.error || inspectionsCountResponse.error || pendingInspectionsCountResponse.error || permitsCountResponse.error || openPermitsCountResponse.error || communicationsCountResponse.error || openPunchItemsCountResponse.error || closeoutResponse.error || assignedEquipmentCountResponse.error || availableEquipmentCountResponse.error || equipmentConflictCountResponse.error || communicationsRecentResponse.error || inspectionsRecentResponse.error || permitsRecentResponse.error || punchItemsRecentResponse.error || punchItemsDetailResponse.error || assignmentsResponse.error || crewsResponse.error || dailyReportEventsResponse.error || photoEventsResponse.error || changeOrdersRecentResponse.error) {
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
        const communicationRows = (communicationsRecentResponse.data ?? []) as ProjectCommunicationSummary[];
        const inspectionRows = (inspectionsRecentResponse.data ?? []) as ProjectInspectionSummary[];
        const permitRows = (permitsRecentResponse.data ?? []) as ProjectPermitSummary[];
        const punchRows = (punchItemsRecentResponse.data ?? []) as ProjectPunchItemSummary[];
        const punchItemDetails = (punchItemsDetailResponse.data ?? []) as ProjectPunchItemDetailSummary[];
        const assignmentRows = (assignmentsResponse.data ?? []) as WorkforceAssignmentSummary[];
        const crewRows = (crewsResponse.data ?? []) as CrewSummary[];
        const dailyReportRows = (dailyReportEventsResponse.data ?? []) as WorkflowDailyReportSummary[];
        const photoRows = (photoEventsResponse.data ?? []) as ProjectPhotoActivitySummary[];
        const changeOrderRows = (changeOrdersRecentResponse.data ?? []) as ChangeOrderActivitySummary[];
        let financialReport: ProjectFinancialReport | null = null;

        try {
          financialReport = await financialReportPromise;
        } catch (financialError) {
          console.error("Project financial report load error:", financialError);
        }

        const profileMap = buildProfileNameMap(profileRows, t("projects.notAssigned"));
        const timelineEntries = buildCommandCenterTimeline({
          communications: communicationRows,
          inspections: inspectionRows,
          permits: permitRows,
          punchItems: punchRows,
          localeTag: locale === "es" ? "es-ES" : "en-US",
        });
        let heroImageUrl: string | null = null;

        if (latestProjectPhotoResponse.data?.storage_path) {
          const signedImage = await client.storage
            .from("project-photos")
            .createSignedUrl(latestProjectPhotoResponse.data.storage_path, 60 * 30);

          heroImageUrl = signedImage.error ? null : signedImage.data?.signedUrl || null;
        }

        if (isSubscribed) {
          setWorkspace({
            project: loadedProject,
            customer: customerRow,
            heroImageUrl,
            profilesById: profileMap,
            tasks: taskRows,
            invoices: invoiceRows,
            counts: {
              estimates: estimatesCountResponse.count || 0,
              changeOrders: changeOrdersCountResponse.count || 0,
              dailyReports: dailyReportsCountResponse.count || 0,
              photos: photosCountResponse.count || 0,
              inspections: inspectionsCountResponse.count || 0,
              pendingInspections: pendingInspectionsCountResponse.count || 0,
              permits: permitsCountResponse.count || 0,
              openPermits: openPermitsCountResponse.count || 0,
              communications: communicationsCountResponse.count || 0,
              openPunchItems: openPunchItemsCountResponse.count || 0,
              assignedEquipment: assignedEquipmentCountResponse.count || 0,
              availableEquipment: availableEquipmentCountResponse.count || 0,
              equipmentConflicts: equipmentConflictCountResponse.count || 0,
            },
            closeout: closeoutResponse.data
              ? {
                id: String(closeoutResponse.data.id),
                status: String(closeoutResponse.data.status || "draft"),
                handoverStatus: String(closeoutResponse.data.handover_status || "pending"),
                finalPaymentRecorded: Boolean(closeoutResponse.data.final_payment_recorded),
                customerApprovalRecorded: Boolean(closeoutResponse.data.customer_approval_recorded),
                requiredDocumentsCompleted: Boolean(closeoutResponse.data.required_documents_completed),
                permitClosureCompleted: Boolean(closeoutResponse.data.permit_closure_completed),
                crewRemovalCompleted: Boolean(closeoutResponse.data.crew_removal_completed),
                equipmentReturnCompleted: Boolean(closeoutResponse.data.equipment_return_completed),
              }
              : null,
            timelineEntries,
            punchItems: punchItemDetails,
            assignments: assignmentRows,
            crews: crewRows,
            dailyReportEvents: dailyReportRows,
            photoEvents: photoRows,
            changeOrderEvents: changeOrderRows,
            communications: communicationRows,
            inspections: inspectionRows,
            financialReport,
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
  }, [locale, projectId, supabase, t]);

  if (isLoading) {
    return <WorkspaceLoadingState rows={4} />;
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
  const location = formatProjectAddress(project as ProjectRow) || t("projects.notProvided");
  const status = normalizeProjectStatus(project.status);
  const statusLabel = getProjectStatusLabel(status.key, t);
  const startDate = formatProjectDateLong(project.estimated_start_date, localeTag, t("projects.notProvided"));
  const completionDate = formatProjectDateLong(project.actual_end_date || project.estimated_end_date, localeTag, t("projects.notProvided"));
  const progress = calculateProjectProgress(workspace.tasks);

  const budgetValueRaw = project.contract_amount ?? project.estimated_cost;
  const spentValueRaw = workspace.invoices.reduce((sum, invoice) => sum + Math.max(0, invoice.amount_paid), 0);

  const budgetValue = formatProjectCurrency(budgetValueRaw, localeTag, t("projects.notProvided"));
  const spentValue = formatProjectCurrency(spentValueRaw, localeTag, "$0");

  const recentActivity = buildRecentActivity({
    project,
    customer: workspace.customer,
    tasks: workspace.tasks,
    invoices: workspace.invoices,
    profilesById: workspace.profilesById,
    localeTag,
    t,
  });

  const timeline = workspace.timelineEntries;
  const completedTasks = workspace.tasks.filter((task) => task.status.trim().toLowerCase() === "completed").length;
  const remainingBudgetRaw = budgetValueRaw !== null ? budgetValueRaw - spentValueRaw : null;
  const remainingBudgetLabel = remainingBudgetRaw !== null
    ? formatProjectCurrency(Math.max(remainingBudgetRaw, 0), localeTag, "$0")
    : t("projects.notProvided");
  const closeoutReady = Boolean(
    workspace.closeout
    && workspace.closeout.finalPaymentRecorded
    && workspace.closeout.customerApprovalRecorded
    && workspace.closeout.requiredDocumentsCompleted
    && workspace.closeout.permitClosureCompleted
    && workspace.closeout.crewRemovalCompleted
    && workspace.closeout.equipmentReturnCompleted,
  );
  const closeoutStatusLabel = workspace.closeout ? `${workspace.closeout.status} / ${workspace.closeout.handoverStatus}` : "Not started";
  const executionTasks = buildExecutionTasks(workspace.tasks, workspace.profilesById);
  const executionIssues = buildExecutionIssues(workspace.punchItems, executionTasks, workspace.profilesById);
  const executionNotes = buildExecutionNotes({
    project,
    dailyReportEvents: workspace.dailyReportEvents,
    communications: workspace.communications,
  });
  const executionActivity = buildExecutionActivity({
    tasks: executionTasks,
    assignments: workspace.assignments,
    dailyReports: workspace.dailyReportEvents,
    photos: workspace.photoEvents,
    documents: workspace.communications,
    changeOrders: workspace.changeOrderEvents,
    milestones: executionTasks.filter((task) => task.kind === "milestone"),
    localeTag,
  });
  const executionCalendarEvents = buildExecutionCalendarEvents({
    projectId: project.id,
    tasks: executionTasks,
    assignments: workspace.assignments,
    crews: workspace.crews,
    inspections: workspace.inspections,
    milestones: executionTasks.filter((task) => task.kind === "milestone"),
    changeOrders: workspace.changeOrderEvents,
  });
  const inspectionMilestones = workspace.inspections.map((item) => ({
    id: item.id,
    label: item.inspection_type,
    status: item.status,
    date: item.scheduled_at || item.completed_at || item.created_at,
  }));
  const completionPercent = executionTasks.length
    ? Math.round((executionTasks.filter((task) => task.status === "completed").length / executionTasks.length) * 100)
    : 0;
  const progressLabel = `${executionTasks.filter((task) => task.status === "completed").length} completed / ${executionTasks.length} total`;
  const openTasksCount = executionTasks.filter((task) => task.status !== "completed").length;
  const upcomingMilestonesCount = executionTasks.filter((task) => task.kind === "milestone" && task.status !== "completed").length;
  const inspectionPendingCount = workspace.counts.pendingInspections;
  const blockedCount = executionTasks.filter((task) => task.status === "blocked").length;

  return (
    <MotionProvider>
      <WorkspaceShell>
        <FadeIn className="min-w-0" delayMs={0} distancePx={4}>
          <ProjectWorkspaceHeader
            projectName={projectName}
            projectNumber={project.project_number}
            customerLabel={customerName}
            customerProjectsHref={customerProjectsHref}
            statusLabel={statusLabel}
            statusKey={status.key}
            customerHref={customerHref}
            editProjectHref={`/projects/${project.id}/edit`}
          />
        </FadeIn>

        <FadeIn className="min-w-0" delayMs={50} distancePx={6}>
          <ProjectWorkspaceHero
            projectId={project.id}
            projectName={projectName}
            customerName={customerName}
            statusLabel={statusLabel}
            statusKey={status.key}
            customerHref={customerHref}
            address={location}
            imageUrl={workspace.heroImageUrl}
            photoCount={workspace.counts.photos}
          />
        </FadeIn>

        <FadeIn className="min-w-0" delayMs={90} distancePx={6}>
          <ProjectKpiGrid
            statusLabel={statusLabel}
            statusKey={status.key}
            budgetLabel={budgetValue}
            spentLabel={spentValue}
            startDate={startDate}
            targetDate={completionDate}
            progressPercent={progress}
            taskCount={workspace.tasks.length}
            completedTaskCount={completedTasks}
          />
        </FadeIn>

        <FadeIn className="min-w-0" delayMs={130} distancePx={4}>
          <ProjectTabs activeTab={activeTab} onChange={handleTabChange} t={t} />
        </FadeIn>

        <div className="min-w-0 rounded-[20px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-surface),var(--bos-bg-workspace-surface-soft))] p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
          <PageTransition transitionKey={`workspace-tab-${activeTab}`} className="min-w-0 max-w-full">
            {activeTab === "overview" ? (
              <ProjectCommandCenterFoundation
                projectId={project.id}
                projectName={projectName}
                tasks={workspace.tasks}
                budgetLabel={budgetValue}
                spentLabel={spentValue}
                remainingLabel={remainingBudgetLabel}
                estimatesCount={workspace.counts.estimates}
                changeOrdersCount={workspace.counts.changeOrders}
                invoicesCount={workspace.invoices.length}
                photosCount={workspace.counts.photos}
                permitsCount={workspace.counts.permits}
                inspectionsCount={workspace.counts.inspections}
                dailyReportsCount={workspace.counts.dailyReports}
                openPunchItemsCount={workspace.counts.openPunchItems}
                openPermitsCount={workspace.counts.openPermits}
                pendingInspectionsCount={workspace.counts.pendingInspections}
                closeoutStatusLabel={closeoutStatusLabel}
                closeoutReady={closeoutReady}
                activityItems={recentActivity}
                timelineEntries={timeline}
              />
            ) : activeTab === "tasks" ? (
              <ProjectExecutionWorkspace
                projectId={project.id}
                projectName={projectName}
                tasks={executionTasks}
                issues={executionIssues}
                notes={executionNotes}
                activity={executionActivity}
                calendarEvents={executionCalendarEvents}
                inspectionMilestones={inspectionMilestones}
                crewAssignmentCount={workspace.assignments.length}
                completionPercent={completionPercent}
                progressLabel={progressLabel}
                openTasksCount={openTasksCount}
                upcomingMilestonesCount={upcomingMilestonesCount}
                inspectionPendingCount={inspectionPendingCount}
                blockedCount={blockedCount}
              />
            ) : activeTab === "photos" ? (
              <SiteCamWorkspace
                companyId={workspace.workspaceContext.companyId}
                projectId={project.id}
                projectName={projectName}
                userId={workspace.workspaceContext.userId}
                locale={locale}
                profilesById={workspace.profilesById}
              />
            ) : activeTab === "blueprints" ? (
              <PlansWorkspace
                projectName={projectName}
                projectId={project.id}
                companyId={workspace.workspaceContext.companyId}
                userId={workspace.workspaceContext.userId}
                initialVersionId={searchParams.get("blueprintVersion")}
                initialPage={Math.max(1, Number(searchParams.get("blueprintPage") || 1))}
                initialAnnotationId={searchParams.get("blueprintAnnotation")}
              />
            ) : activeTab === "inspections" ? (
              <ProjectComplianceWorkflow
                projectId={project.id}
                workspaceContext={workspace.workspaceContext}
              />
            ) : activeTab === "financials" ? (
              workspace.financialReport ? (
                <ProjectFinancialReporting report={workspace.financialReport} />
              ) : (
                <ProjectCommandCenterTabPlaceholder tabLabel="Financials data unavailable" />
              )
            ) : activeTab === "subcontractors" ? (
              <ProjectTradePartnersWorkspace projectId={project.id} />
            ) : (
              <ProjectCommandCenterTabPlaceholder tabLabel={getWorkspaceTabLabel(activeTab, t)} />
            )}
          </PageTransition>
        </div>
      </WorkspaceShell>
    </MotionProvider>
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
    "tasks",
    "daily_logs",
    "photos",
    "blueprints",
    "documents",
    "subcontractors",
    "crew",
    "financials",
    "change_orders",
    "rfis",
    "inspections",
    "activity",
  ];
  const aliases: Record<string, WorkspaceTab> = {
    work: "tasks",
    financial: "financials",
    resources: "crew",
    timeline: "activity",
  };

  if (!tabParam) {
    return "overview";
  }

  if (aliases[tabParam]) {
    return aliases[tabParam];
  }

  return validTabs.includes(tabParam as WorkspaceTab) ? (tabParam as WorkspaceTab) : "overview";
}

function getWorkspaceTabLabel(tab: WorkspaceTab, t: (key: string) => string) {
  const keyByTab: Record<WorkspaceTab, string> = {
    overview: "projects.workspaceTabOverview",
    tasks: "projects.workspaceTabTasks",
    daily_logs: "projects.workspaceTabDailyLogs",
    photos: "projects.workspaceTabPhotos",
    blueprints: "projects.workspaceTabBlueprints",
    documents: "projects.workspaceTabDocuments",
    subcontractors: "projects.workspaceTabSubcontractors",
    crew: "projects.workspaceTabCrew",
    financials: "projects.workspaceTabFinancials",
    change_orders: "projects.workspaceTabChangeOrders",
    rfis: "projects.workspaceTabRfis",
    submittals: "projects.workspaceTabSubmittals",
    inspections: "projects.workspaceTabInspections",
    activity: "projects.workspaceTabActivity",
  };

  return t(keyByTab[tab]);
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

function formatDateTime(value: string, localeTag: string) {
  return new Intl.DateTimeFormat(localeTag, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function buildCommandCenterTimeline({
  communications,
  inspections,
  permits,
  punchItems,
  localeTag,
}: {
  communications: ProjectCommunicationSummary[];
  inspections: ProjectInspectionSummary[];
  permits: ProjectPermitSummary[];
  punchItems: ProjectPunchItemSummary[];
  localeTag: string;
}): CommandCenterTimelineEntry[] {
  const entries: Array<CommandCenterTimelineEntry & { orderDate: string }> = [];

  for (const item of communications) {
    entries.push({
      id: `comm-${item.id}`,
      title: `Communication ${item.channel}`,
      detail: `${item.status}${item.subject ? ` - ${item.subject}` : ""}`,
      occurredAt: formatDateTime(item.created_at, localeTag),
      tone: item.status === "failed" ? "warning" : "info",
      orderDate: item.created_at,
    });
  }

  for (const item of inspections) {
    entries.push({
      id: `inspection-${item.id}`,
      title: `Inspection ${item.inspection_type}`,
      detail: `Status: ${item.status}`,
      occurredAt: formatDateTime(item.created_at, localeTag),
      tone: item.status === "passed" ? "success" : item.status === "failed" ? "warning" : "neutral",
      orderDate: item.created_at,
    });
  }

  for (const item of permits) {
    entries.push({
      id: `permit-${item.id}`,
      title: `Permit ${item.permit_type}`,
      detail: `Status: ${item.status}`,
      occurredAt: formatDateTime(item.created_at, localeTag),
      tone: item.status === "approved" || item.status === "issued" || item.status === "closed" ? "success" : "warning",
      orderDate: item.created_at,
    });
  }

  for (const item of punchItems) {
    entries.push({
      id: `punch-${item.id}`,
      title: item.title,
      detail: `Punch item ${item.status}`,
      occurredAt: formatDateTime(item.created_at, localeTag),
      tone: item.status === "completed" ? "success" : "warning",
      orderDate: item.created_at,
    });
  }

  return entries
    .sort((left, right) => right.orderDate.localeCompare(left.orderDate))
    .slice(0, 16)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      detail: entry.detail,
      occurredAt: entry.occurredAt,
      tone: entry.tone,
    }));
}

function buildExecutionTasks(tasks: TaskSummary[], profilesById: Record<string, string>): ProjectExecutionTask[] {
  return tasks.map((task) => {
    const normalized = normalizeExecutionStatus(task.status);
    const lowerTitle = task.title.trim().toLowerCase();
    const kind = lowerTitle.includes("milestone")
      ? "milestone"
      : lowerTitle.includes("deliverable") || lowerTitle.includes("delivery")
        ? "deliverable"
        : "task";

    return {
      id: task.id,
      kind,
      title: task.title,
      description: task.description?.trim() || task.notes?.trim() || "",
      priority: task.priority || "medium",
      status: normalized,
      dueDate: task.planned_finish,
      assigneeId: task.assigned_profile_id,
      assigneeLabel: task.assigned_profile_id ? profilesById[task.assigned_profile_id] || "Unassigned" : "Unassigned",
      completedAt: task.actual_finish || (normalized === "completed" ? task.updated_at : null),
      dependencyIds: [],
    };
  });
}

function buildExecutionIssues(
  punchItems: ProjectPunchItemDetailSummary[],
  tasks: ProjectExecutionTask[],
  profilesById: Record<string, string>,
): ProjectExecutionIssue[] {
  const issueFromPunch = punchItems.map((item) => ({
    id: `punch-${item.id}`,
    title: item.title,
    status: normalizeIssueStatus(item.status),
    priority: item.priority || "medium",
    ownerId: item.assigned_profile_id,
    ownerLabel: item.assigned_profile_id ? profilesById[item.assigned_profile_id] || "Unassigned" : "Unassigned",
    dueDate: item.due_date,
    source: "punch_item" as const,
  }));

  const issueFromTasks = tasks
    .filter((task) => task.status === "blocked")
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      status: "blocked" as const,
      priority: task.priority,
      ownerId: task.assigneeId,
      ownerLabel: task.assigneeLabel,
      dueDate: task.dueDate,
      source: "task" as const,
    }));

  return [...issueFromPunch, ...issueFromTasks].sort((left, right) => {
    const leftDue = left.dueDate || "9999-12-31";
    const rightDue = right.dueDate || "9999-12-31";
    return leftDue.localeCompare(rightDue);
  });
}

function buildExecutionNotes({
  project,
  dailyReportEvents,
  communications,
}: {
  project: ProjectSummary;
  dailyReportEvents: WorkflowDailyReportSummary[];
  communications: ProjectCommunicationSummary[];
}): ProjectExecutionNote[] {
  const notes: ProjectExecutionNote[] = [];

  if (project.description?.trim()) {
    notes.push({
      id: "note-general-project",
      category: "general",
      body: project.description.trim(),
      createdAt: project.updated_at,
      createdByLabel: "Project Workspace",
    });
  }

  for (const row of dailyReportEvents.slice(0, 6)) {
    const payloadRecord = toRecord(row.payload);
    const payloadSummary = typeof payloadRecord.summary === "string" ? payloadRecord.summary : null;
    const payloadTitle = typeof payloadRecord.report_number === "string" ? payloadRecord.report_number : null;

    notes.push({
      id: `note-field-${row.id}`,
      category: "field",
      body: payloadSummary || payloadTitle || "Daily report submitted",
      createdAt: row.occurred_at || row.created_at,
      createdByLabel: "Field",
    });
  }

  for (const item of communications.slice(0, 6)) {
    notes.push({
      id: `note-office-${item.id}`,
      category: "office",
      body: `${item.channel} ${item.subject ? `- ${item.subject}` : ""}`.trim(),
      createdAt: item.created_at,
      createdByLabel: "Office",
    });
  }

  notes.push({
    id: "note-private-template",
    category: "private",
    body: "Private notes are kept in your local session draft.",
    createdAt: project.updated_at,
    createdByLabel: "You",
  });

  return notes
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 24);
}

function buildExecutionCalendarEvents({
  projectId,
  tasks,
  assignments,
  crews,
  inspections,
  milestones,
  changeOrders,
}: {
  projectId: string;
  tasks: ProjectExecutionTask[];
  assignments: WorkforceAssignmentSummary[];
  crews: CrewSummary[];
  inspections: ProjectInspectionSummary[];
  milestones: ProjectExecutionTask[];
  changeOrders: ChangeOrderActivitySummary[];
}): ProjectExecutionCalendarEvent[] {
  const crewNameById = Object.fromEntries(crews.map((crew) => [crew.id, crew.name]));
  const events: ProjectExecutionCalendarEvent[] = [];

  for (const task of tasks) {
    if (!task.dueDate) {
      continue;
    }

    events.push({
      id: `task-${task.id}`,
      type: task.kind === "milestone" ? "milestone" : "task",
      title: task.title,
      date: task.dueDate,
      href: `/projects/${projectId}?tab=tasks`,
    });
  }

  for (const assignment of assignments) {
    events.push({
      id: `assign-${assignment.id}`,
      type: "crew_assignment",
      title: assignment.crew_id ? `Crew: ${crewNameById[assignment.crew_id] || assignment.crew_id}` : assignment.title,
      date: assignment.starts_at.slice(0, 10),
      href: `/projects/${projectId}?tab=crew`,
    });
  }

  for (const inspection of inspections) {
    const inspectionDate = inspection.scheduled_at || inspection.completed_at || inspection.created_at;
    events.push({
      id: `inspection-${inspection.id}`,
      type: "inspection",
      title: inspection.inspection_type,
      date: inspectionDate.slice(0, 10),
      href: `/projects/${projectId}?tab=inspections`,
    });
  }

  for (const milestone of milestones) {
    if (!milestone.dueDate) {
      continue;
    }

    events.push({
      id: `milestone-${milestone.id}`,
      type: "milestone",
      title: milestone.title,
      date: milestone.dueDate,
      href: `/projects/${projectId}?tab=tasks`,
    });
  }

  for (const item of changeOrders) {
    const deliveryDate = item.requested_date || item.updated_at || item.created_at;
    events.push({
      id: `delivery-${item.id}`,
      type: "delivery",
      title: item.change_order_number?.trim() || item.title,
      date: deliveryDate.slice(0, 10),
      href: `/projects/${projectId}?tab=change_orders`,
    });
  }

  return events.sort((left, right) => left.date.localeCompare(right.date)).slice(0, 140);
}

function buildExecutionActivity({
  tasks,
  assignments,
  dailyReports,
  photos,
  documents,
  changeOrders,
  milestones,
  localeTag,
}: {
  tasks: ProjectExecutionTask[];
  assignments: WorkforceAssignmentSummary[];
  dailyReports: WorkflowDailyReportSummary[];
  photos: ProjectPhotoActivitySummary[];
  documents: ProjectCommunicationSummary[];
  changeOrders: ChangeOrderActivitySummary[];
  milestones: ProjectExecutionTask[];
  localeTag: string;
}): Array<{ id: string; title: string; detail: string; occurredAt: string; tone: "neutral" | "info" | "warning" | "success" }> {
  const entries: Array<{ id: string; title: string; detail: string; occurredAtRaw: string; occurredAt: string; tone: "neutral" | "info" | "warning" | "success" }> = [];

  for (const task of tasks.slice(0, 30)) {
    entries.push({
      id: `activity-task-${task.id}`,
      title: "Task Update",
      detail: `${task.title} moved to ${task.status}`,
      occurredAtRaw: task.completedAt || task.dueDate || new Date().toISOString(),
      occurredAt: formatDateTime(task.completedAt || task.dueDate || new Date().toISOString(), localeTag),
      tone: task.status === "completed" ? "success" : task.status === "blocked" ? "warning" : "info",
    });
  }

  for (const milestone of milestones.slice(0, 16)) {
    entries.push({
      id: `activity-milestone-${milestone.id}`,
      title: "Milestone Change",
      detail: `${milestone.title} is ${milestone.status}`,
      occurredAtRaw: milestone.completedAt || milestone.dueDate || new Date().toISOString(),
      occurredAt: formatDateTime(milestone.completedAt || milestone.dueDate || new Date().toISOString(), localeTag),
      tone: milestone.status === "completed" ? "success" : "neutral",
    });
  }

  for (const row of dailyReports.slice(0, 12)) {
    entries.push({
      id: `activity-daily-${row.id}`,
      title: "Daily Report",
      detail: row.event_type,
      occurredAtRaw: row.occurred_at || row.created_at,
      occurredAt: formatDateTime(row.occurred_at || row.created_at, localeTag),
      tone: "info",
    });
  }

  for (const row of assignments.slice(0, 20)) {
    entries.push({
      id: `activity-crew-${row.id}`,
      title: "Crew Update",
      detail: `${row.title} (${row.status})`,
      occurredAtRaw: row.updated_at,
      occurredAt: formatDateTime(row.updated_at, localeTag),
      tone: row.status === "completed" ? "success" : "neutral",
    });
  }

  for (const row of photos.slice(0, 12)) {
    entries.push({
      id: `activity-photo-${row.id}`,
      title: "Photo Uploaded",
      detail: row.note?.trim() || row.category,
      occurredAtRaw: row.created_at,
      occurredAt: formatDateTime(row.created_at, localeTag),
      tone: "info",
    });
  }

  for (const row of documents.slice(0, 12)) {
    entries.push({
      id: `activity-doc-${row.id}`,
      title: "Document Activity",
      detail: `${row.channel} ${row.subject ? `- ${row.subject}` : ""}`.trim(),
      occurredAtRaw: row.created_at,
      occurredAt: formatDateTime(row.created_at, localeTag),
      tone: row.status === "failed" ? "warning" : "neutral",
    });
  }

  for (const row of changeOrders.slice(0, 12)) {
    entries.push({
      id: `activity-co-${row.id}`,
      title: "Change Order",
      detail: `${row.change_order_number || row.title} (${row.status})`,
      occurredAtRaw: row.updated_at || row.created_at,
      occurredAt: formatDateTime(row.updated_at || row.created_at, localeTag),
      tone: row.status === "approved" ? "success" : row.status === "rejected" ? "warning" : "info",
    });
  }

  return entries
    .sort((left, right) => right.occurredAtRaw.localeCompare(left.occurredAtRaw))
    .slice(0, 48)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      detail: entry.detail,
      occurredAt: entry.occurredAt,
      tone: entry.tone,
    }));
}

function normalizeExecutionStatus(status: string): ProjectExecutionTask["status"] {
  const normalized = status.trim().toLowerCase();

  if (normalized === "completed" || normalized === "done") {
    return "completed";
  }

  if (normalized === "in_progress") {
    return "in_progress";
  }

  if (normalized === "blocked") {
    return "blocked";
  }

  if (normalized === "waiting" || normalized === "on_hold") {
    return "waiting";
  }

  return "not_started";
}

function normalizeIssueStatus(status: string): ProjectExecutionIssue["status"] {
  const normalized = status.trim().toLowerCase();

  if (normalized === "completed" || normalized === "closed") {
    return "resolved";
  }

  if (normalized === "blocked") {
    return "blocked";
  }

  return "open";
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
