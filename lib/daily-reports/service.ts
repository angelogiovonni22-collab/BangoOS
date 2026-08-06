import { buildDeterministicDailySummary } from "./ai-summary";
import { createSchedulingService } from "@/lib/scheduling";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type {
  DailyReport,
  DailyReportDashboardPayload,
  DailyReportFilters,
  DailyReportListResult,
  DailyReportShift,
  DailyReportStatus,
  DailyReportUpsertInput,
  LaborEntry,
  LaborTotals,
  SchedulingPreload,
} from "./types";

export type DailyReportsService = {
  getDashboard: () => Promise<DailyReportDashboardPayload>;
  listReports: (filters: DailyReportFilters) => Promise<DailyReportListResult>;
  getReport: (reportId: string) => Promise<DailyReport | null>;
  createReport: (
    input: DailyReportUpsertInput,
    status: DailyReportStatus,
  ) => Promise<DailyReport>;
  updateReport: (
    reportId: string,
    input: DailyReportUpsertInput,
    status: DailyReportStatus,
  ) => Promise<DailyReport | null>;
  regenerateSummary: (reportId: string) => Promise<DailyReport | null>;
  createDraftFromSchedule: (date: string) => Promise<DailyReportUpsertInput>;
  toUpsertInput: (report: DailyReport) => DailyReportUpsertInput;
};

type CreateDailyReportsServiceDeps = {
  supabaseClient?: ReturnType<typeof createClient>;
  resolveWorkspace?: typeof resolveWorkspaceContext;
};

const DAILY_REPORT_EVENT_TYPES = ["daily_report.created", "daily_report.updated"];

type WorkflowDailyReportEventRow = {
  id: string;
  reference_id: string;
  occurred_at: string;
  event_type: string;
  payload: Record<string, unknown>;
};

function buildBlankDraft(date: string): DailyReportUpsertInput {
  return {
    header: {
      projectId: "",
      projectName: "",
      date,
      shift: "day",
      superintendentId: "",
      superintendentName: "",
      projectManagerName: "",
      weather: "mixed",
      temperatureF: 0,
      siteConditions: "dry",
      overallStatus: "draft",
    },
    schedulingPreload: null,
    labor: [],
    workCompleted: [],
    materials: [],
    safety: [],
    delays: [],
    attachments: [],
    timeline: [],
    aiSummaryVersion: 1,
  };
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toUpsertInput(report: DailyReport): DailyReportUpsertInput {
  return {
    header: cloneValue(report.header),
    schedulingPreload: cloneValue(report.schedulingPreload),
    labor: cloneValue(report.labor),
    workCompleted: cloneValue(report.workCompleted),
    materials: cloneValue(report.materials),
    safety: cloneValue(report.safety),
    delays: cloneValue(report.delays),
    attachments: cloneValue(report.attachments),
    timeline: cloneValue(report.timeline),
    aiSummaryVersion: report.aiSummaryVersion,
  };
}

export function calculateLaborTotals(labor: LaborEntry[]): LaborTotals {
  const scheduledWorkers = labor.filter((item) => item.scheduled).length;
  const presentWorkers = labor.filter((item) => item.present).length;
  const absentWorkers = Math.max(scheduledWorkers - presentWorkers, 0);

  return {
    scheduledWorkers,
    presentWorkers,
    absentWorkers,
    lateWorkers: labor.filter((item) => item.late).length,
    overtimeWorkers: labor.filter((item) => item.overtimeHours > 0).length,
    totalLaborHours: Number(labor.reduce((acc, item) => acc + item.regularHours + item.overtimeHours, 0).toFixed(1)),
  };
}

async function buildLiveDraft(date: string): Promise<DailyReportUpsertInput> {
  const scheduling = createSchedulingService();
  const payload = await scheduling.getScheduling();
  const matchingAssignment = payload.assignments.find((item) => item.date === date) ?? payload.assignments[0] ?? null;

  if (!matchingAssignment) {
    return buildBlankDraft(date);
  }

  const projectName = matchingAssignment.scope.projectName?.trim() || matchingAssignment.scope.projectId;
  const projectManagerName = matchingAssignment.scope.supervisor?.trim() || "";
  const superintendentName = matchingAssignment.scope.supervisor?.trim() || "";

  const schedulingPreload: SchedulingPreload = {
    assignmentId: matchingAssignment.id,
    assignmentTitle: matchingAssignment.title,
    plannedHours: matchingAssignment.plannedLaborHours,
    scheduledProjectId: matchingAssignment.scope.projectId,
    scheduledProjectName: projectName,
    assignedCrewNames: matchingAssignment.assignedCrewIds.map((crewId) => payload.crewOptions.find((crew) => crew.id === crewId)?.name || crewId),
    scheduledEmployees: matchingAssignment.assignedEmployeeIds.map((employeeId) => payload.employeeOptions.find((employee) => employee.id === employeeId)?.name || employeeId),
    supervisor: matchingAssignment.scope.supervisor,
  };

  const labor = matchingAssignment.assignedEmployeeIds.length > 0
    ? matchingAssignment.assignedEmployeeIds.map((employeeId, index) => {
      const employee = payload.employeeOptions.find((item) => item.id === employeeId);

      return {
        id: crypto.randomUUID(),
        crewName: matchingAssignment.assignedCrewIds
          .map((crewId) => payload.crewOptions.find((crew) => crew.id === crewId)?.name || crewId)
          .join(", "),
        employeeName: employee?.name || `Worker ${index + 1}`,
        trade: employee?.trade || matchingAssignment.requiredTrade || "",
        scheduled: true,
        present: true,
        late: false,
        regularHours: Number(Math.min(8, matchingAssignment.plannedLaborHours / Math.max(matchingAssignment.requiredHeadcount, 1)).toFixed(1)),
        overtimeHours: 0,
        notes: "",
      };
    })
    : [];

  return {
    header: {
      projectId: matchingAssignment.scope.projectId,
      projectName,
      date,
      shift: matchingAssignment.shift,
      superintendentId: "",
      superintendentName,
      projectManagerName,
      weather: "mixed",
      temperatureF: 0,
      siteConditions: "dry",
      overallStatus: "draft",
    },
    schedulingPreload,
    labor,
    workCompleted: [],
    materials: [],
    safety: [],
    delays: [],
    attachments: [],
    timeline: [],
    aiSummaryVersion: 1,
  };
}

export function createDailyReportsService(deps: CreateDailyReportsServiceDeps = {}): DailyReportsService {
  const supabase = deps.supabaseClient ?? createClient();
  const resolveWorkspace = deps.resolveWorkspace ?? resolveWorkspaceContext;
  let inFlightContext: Promise<{ supabase: NonNullable<typeof supabase>; workspace: NonNullable<Awaited<ReturnType<typeof resolveWorkspaceContext>>["context"]> }> | null = null;
  const inFlightReportsByCompany = new Map<string, Promise<DailyReport[]>>();

  type LooseSupabase = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
  };

  async function resolveContext() {
    if (inFlightContext) {
      return inFlightContext;
    }

    inFlightContext = (async () => {
    if (!supabase) {
      throw new Error("Unable to connect to storage.");
    }

    const workspace = await resolveWorkspace(supabase);

    if (workspace.errorMessage || !workspace.context) {
      throw new Error(workspace.errorMessage || "Unable to resolve workspace context.");
    }

    return {
      supabase,
      workspace: workspace.context,
    };
    })();

    try {
      return await inFlightContext;
    } finally {
      inFlightContext = null;
    }
  }

  function calculateLaborTotals(labor: LaborEntry[]): LaborTotals {
    const scheduledWorkers = labor.filter((item) => item.scheduled).length;
    const presentWorkers = labor.filter((item) => item.present).length;
    const absentWorkers = Math.max(scheduledWorkers - presentWorkers, 0);

    return {
      scheduledWorkers,
      presentWorkers,
      absentWorkers,
      lateWorkers: labor.filter((item) => item.late).length,
      overtimeWorkers: labor.filter((item) => item.overtimeHours > 0).length,
      totalLaborHours: Number(labor.reduce((acc, item) => acc + item.regularHours + item.overtimeHours, 0).toFixed(1)),
    };
  }

  function applyStatusTransition(report: DailyReport, status: DailyReportStatus) {
    const now = new Date().toISOString();
    report.header.overallStatus = status;

    if (status === "submitted" && !report.submittedAt) {
      report.submittedAt = now;
    }

    if (status === "reviewed" && !report.reviewedAt) {
      report.reviewedAt = now;
    }

    if (status === "approved" && !report.approvedAt) {
      report.approvedAt = now;
    }
  }

  function normalizeShift(value: string): DailyReportShift {
    if (value === "swing" || value === "night") {
      return value;
    }

    return "day";
  }

  function hydrateReportFromInput(base: Pick<DailyReport, "id" | "reportNumber" | "createdAt" | "submittedAt" | "reviewedAt" | "approvedAt">, input: DailyReportUpsertInput, status: DailyReportStatus): DailyReport {
    const now = new Date().toISOString();
    const report: DailyReport = {
      id: base.id,
      reportNumber: base.reportNumber,
      header: {
        ...input.header,
        shift: normalizeShift(input.header.shift),
        overallStatus: status,
      },
      schedulingPreload: input.schedulingPreload,
      labor: input.labor,
      laborTotals: calculateLaborTotals(input.labor),
      workCompleted: input.workCompleted,
      materials: input.materials,
      safety: input.safety,
      delays: input.delays,
      attachments: input.attachments,
      timeline: input.timeline,
      aiSummary: "",
      aiSummaryVersion: input.aiSummaryVersion,
      submittedAt: base.submittedAt,
      reviewedAt: base.reviewedAt,
      approvedAt: base.approvedAt,
      createdAt: base.createdAt,
      updatedAt: now,
    };

    applyStatusTransition(report, status);
    report.aiSummary = buildDeterministicDailySummary(report);

    return report;
  }

  function parseDailyReportFromEvent(row: WorkflowDailyReportEventRow): DailyReport | null {
    const payload = row.payload || {};
    const report = payload.report;

    if (!report || typeof report !== "object") {
      return null;
    }

    return report as DailyReport;
  }

  async function fetchDailyReportEvents(companyId: string, reportId?: string) {
    const db = supabase as unknown as LooseSupabase;
    let query = db
      .from("workflow_events")
      .select("id, reference_id, occurred_at, event_type, payload")
      .eq("company_id", companyId)
      .eq("reference_entity", "daily_report")
      .in("event_type", DAILY_REPORT_EVENT_TYPES)
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false });

    if (reportId) {
      query = query.eq("reference_id", reportId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Unable to load daily report events.");
    }

    return ((data || []) as unknown) as WorkflowDailyReportEventRow[];
  }

  async function loadReportsFromEvents(companyId: string) {
    const rows = await fetchDailyReportEvents(companyId);
    const byReportId = new Map<string, DailyReport>();

    for (const row of rows) {
      if (byReportId.has(row.reference_id)) {
        continue;
      }

      const report = parseDailyReportFromEvent(row);
      if (report) {
        byReportId.set(row.reference_id, report);
      }
    }

    return [...byReportId.values()];
  }

  async function loadReportsFromEventsShared(companyId: string) {
    const existing = inFlightReportsByCompany.get(companyId);

    if (existing) {
      return existing;
    }

    const request = loadReportsFromEvents(companyId)
      .finally(() => {
        inFlightReportsByCompany.delete(companyId);
      });

    inFlightReportsByCompany.set(companyId, request);
    return request;
  }

  async function loadReportById(companyId: string, reportId: string) {
    const rows = await fetchDailyReportEvents(companyId, reportId);
    const row = rows[0] || null;

    if (!row) {
      return null;
    }

    return parseDailyReportFromEvent(row);
  }

  function applySort(items: DailyReport[], sortBy: DailyReportFilters["sortBy"]) {
    const copy = [...items];

    if (sortBy === "date_desc") {
      return copy.sort((a, b) => b.header.date.localeCompare(a.header.date));
    }

    if (sortBy === "date_asc") {
      return copy.sort((a, b) => a.header.date.localeCompare(b.header.date));
    }

    if (sortBy === "project_asc") {
      return copy.sort((a, b) => a.header.projectName.localeCompare(b.header.projectName));
    }

    return copy.sort((a, b) => a.header.overallStatus.localeCompare(b.header.overallStatus));
  }

  async function publishDailyReportEvent(params: {
    companyId: string;
    actorProfileId: string;
    report: DailyReport;
    eventType: "daily_report.created" | "daily_report.updated";
    idempotencySuffix: string;
  }) {
    if (!supabase) {
      throw new Error("Unable to connect to event store.");
    }

    const publisher = createSupabaseOrionEventPublisher(supabase);

    await publisher.publishEvent({
      company_id: params.companyId,
      actor_profile_id: params.actorProfileId,
      event_type: params.eventType,
      aggregate_type: "daily_report",
      aggregate_id: params.report.id,
      source_module: "daily_reports",
      idempotency_key: `daily-report:${params.report.id}:${params.idempotencySuffix}`,
      payload: {
        report: params.report,
        report_id: params.report.id,
        report_number: params.report.reportNumber,
        project_id: params.report.header.projectId,
        report_date: params.report.header.date,
        status: params.report.header.overallStatus,
        deep_link: `/daily-reports/${params.report.id}`,
      },
      metadata: {
        event_category: "field",
        event_severity: params.report.header.overallStatus === "approved" ? "success" : "info",
        deep_link: `/daily-reports/${params.report.id}`,
      },
    });
  }

  return {
    async getDashboard() {
      const { workspace } = await resolveContext();
      const reports = await loadReportsFromEventsShared(workspace.companyId);
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const reportsCreatedToday = reports.filter((item) => item.header.date === today).length;
      const reportsPendingReview = reports.filter((item) => item.header.overallStatus === "submitted").length;
      const reportsSubmitted = reports.filter((item) => ["submitted", "reviewed", "approved"].includes(item.header.overallStatus)).length;
      const lateReports = reports.filter((item) => item.header.date < yesterday && item.header.overallStatus === "draft").length;
      const safetyIncidents = reports.reduce((acc, item) => acc + item.safety.filter((entry) => entry.type === "incident" || entry.type === "near_miss").length, 0);
      const delaysLogged = reports.reduce((acc, item) => acc + item.delays.length, 0);
      const laborHours = Number(reports.reduce((acc, item) => acc + item.laborTotals.totalLaborHours, 0).toFixed(1));
      const weatherSnapshot = reports.find((item) => item.header.date === today)?.header.weather || "mixed";

      return {
        metrics: {
          reportsCreatedToday,
          reportsPendingReview,
          reportsSubmitted,
          lateReports,
          safetyIncidents,
          delaysLogged,
          laborHours,
          weatherSnapshot,
        },
        analytics: {
          laborHours,
          productionUnits: Number(reports.flatMap((item) => item.workCompleted).reduce((acc, item) => acc + item.quantity, 0).toFixed(1)),
          delayEvents: delaysLogged,
          incidentCount: safetyIncidents,
          completionRate: reports.length === 0 ? 0 : Math.round((reportsSubmitted / reports.length) * 100),
          averageSubmissionHours: 0,
        },
        weatherSnapshotText: weatherSnapshot,
        projectOptions: Array.from(new Map(reports.map((item) => [item.header.projectId, { id: item.header.projectId, name: item.header.projectName }])).values()),
        superintendentOptions: Array.from(new Map(reports.map((item) => [item.header.superintendentId, { id: item.header.superintendentId, name: item.header.superintendentName }])).values()),
      };
    },

    async listReports(filters) {
      const { workspace } = await resolveContext();
      const reports = await loadReportsFromEventsShared(workspace.companyId);

      const query = filters.query.trim().toLowerCase();
      const filtered = reports.filter((item) => {
        const matchesDate = !filters.date || item.header.date === filters.date;
        const matchesProject = filters.projectId === "all" || item.header.projectId === filters.projectId;
        const matchesSuperintendent = filters.superintendentId === "all" || item.header.superintendentId === filters.superintendentId;
        const matchesStatus = filters.status === "all" || item.header.overallStatus === filters.status;
        const matchesQuery = !query
          || item.reportNumber.toLowerCase().includes(query)
          || item.header.projectName.toLowerCase().includes(query)
          || item.header.superintendentName.toLowerCase().includes(query);

        return matchesDate && matchesProject && matchesSuperintendent && matchesStatus && matchesQuery;
      });

      const sorted = applySort(filtered, filters.sortBy);
      const page = Number.isFinite(filters.page) && filters.page > 0 ? filters.page : 1;
      const pageSize = Number.isFinite(filters.pageSize) && filters.pageSize > 0 ? filters.pageSize : 1;
      const total = sorted.length;
      const totalPages = Math.max(Math.ceil(total / pageSize), 1);
      const boundedPage = Math.min(Math.max(page, 1), totalPages);
      const start = (boundedPage - 1) * pageSize;

      const response: DailyReportListResult = {
        items: sorted.slice(start, start + pageSize),
        total,
        totalPages,
        page: boundedPage,
        pageSize,
      };

      return response;
    },

    async getReport(reportId) {
      const { workspace } = await resolveContext();
      return loadReportById(workspace.companyId, reportId);
    },

    async createReport(input, status) {
      const { workspace } = await resolveContext();
      const reports = await loadReportsFromEvents(workspace.companyId);
      const nextOrdinal = reports.filter((item) => item.header.date === input.header.date).length + 1;
      const compactDate = input.header.date.replace(/-/g, "");
      const report: DailyReport = hydrateReportFromInput({
        id: crypto.randomUUID(),
        reportNumber: `DR-${compactDate}-${String(nextOrdinal).padStart(3, "0")}`,
        createdAt: new Date().toISOString(),
        submittedAt: null,
        reviewedAt: null,
        approvedAt: null,
      }, input, status);

      await publishDailyReportEvent({
        companyId: workspace.companyId,
        actorProfileId: workspace.userId,
        report,
        eventType: "daily_report.created",
        idempotencySuffix: "create",
      });

      return report;
    },

    async updateReport(reportId, input, status) {
      const { workspace } = await resolveContext();
      const current = await loadReportById(workspace.companyId, reportId);

      if (!current) {
        return null;
      }

      const report = hydrateReportFromInput({
        id: current.id,
        reportNumber: current.reportNumber,
        createdAt: current.createdAt,
        submittedAt: current.submittedAt,
        reviewedAt: current.reviewedAt,
        approvedAt: current.approvedAt,
      }, input, status);

      await publishDailyReportEvent({
        companyId: workspace.companyId,
        actorProfileId: workspace.userId,
        report,
        eventType: "daily_report.updated",
        idempotencySuffix: `update:${report.updatedAt}`,
      });

      return report;
    },

    async regenerateSummary(reportId) {
      const { workspace } = await resolveContext();
      const current = await loadReportById(workspace.companyId, reportId);

      if (!current) {
        return null;
      }

      const report: DailyReport = {
        ...current,
        aiSummaryVersion: current.aiSummaryVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      report.aiSummary = buildDeterministicDailySummary(report);

      await publishDailyReportEvent({
        companyId: workspace.companyId,
        actorProfileId: workspace.userId,
        report,
        eventType: "daily_report.updated",
        idempotencySuffix: `summary:${report.aiSummaryVersion}`,
      });

      return report;
    },

    async createDraftFromSchedule(date) {
      return buildLiveDraft(date);
    },

    toUpsertInput,
  };
}
