import { createDailyReportsService } from "@/lib/daily-reports";
import type { DailyReportStatus, DailyReportUpsertInput } from "@/lib/daily-reports";
import { ORION_INITIAL_COMMANDS } from "./registry";
import type {
  OrionCommandDependencies,
  OrionCommandExecutionContext,
  OrionCommandExecutionOutput,
  OrionCommandValidationResult,
} from "./types";

const DAILY_REPORT_STATUSES = new Set<DailyReportStatus>(["draft", "submitted", "reviewed", "approved"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function requireString(params: Record<string, unknown>, key: string) {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function validateCreateDailyReport(params: unknown): OrionCommandValidationResult {
  const row = asRecord(params);
  if (!row) {
    return { ok: false, errors: ["Daily report parameters must be an object."] };
  }

  const errors: string[] = [];
  const reportDate = typeof row.reportDate === "string" ? row.reportDate.trim() : "";
  const projectId = typeof row.projectId === "string" ? row.projectId.trim() : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    errors.push("reportDate must use YYYY-MM-DD format.");
  }

  if (!projectId) {
    errors.push("projectId is required.");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedParams: errors.length === 0 ? { ...row, reportDate, projectId } : undefined,
  };
}

function validateUpdateDailyReport(params: unknown): OrionCommandValidationResult {
  const row = asRecord(params);
  if (!row) {
    return { ok: false, errors: ["Daily report parameters must be an object."] };
  }

  const reportId = typeof row.reportId === "string" ? row.reportId.trim() : "";
  const updates = asRecord(row.updates);
  const errors: string[] = [];

  if (!reportId) {
    errors.push("reportId is required.");
  }

  if (!updates) {
    errors.push("updates must be an object.");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedParams: errors.length === 0 ? { ...row, reportId, updates } : undefined,
  };
}

async function resolveProjectName(
  deps: OrionCommandDependencies,
  context: OrionCommandExecutionContext,
  projectId: string,
) {
  const { data, error } = await deps.supabase
    .from("projects")
    .select("id, name")
    .eq("company_id", context.companyId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to resolve the project for this daily report.");
  }

  if (!data) {
    throw new Error("The selected project could not be found in this company.");
  }

  return data.name?.trim() || "Project";
}

function blankDailyReportInput(projectId: string, projectName: string, reportDate: string): DailyReportUpsertInput {
  return {
    header: {
      projectId,
      projectName,
      date: reportDate,
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
    equipment: [],
    safety: [],
    delays: [],
    attachments: [],
    timeline: [],
    aiSummaryVersion: 1,
  };
}

async function executeCreateDailyReportCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const reportDate = requireString(params, "reportDate");
  const projectId = requireString(params, "projectId");
  const projectName = await resolveProjectName(deps, context, projectId);
  const service = createDailyReportsService({ supabaseClient: deps.supabase });
  const report = await service.createReport(blankDailyReportInput(projectId, projectName, reportDate), "draft");

  return {
    status: "completed",
    entityType: "daily_report",
    entityId: report.id,
    createdEntityIds: [report.id],
    publishedEventIds: [],
    href: `/daily-reports/${report.id}`,
    userMessage: `Daily report ${report.reportNumber} was created for ${projectName}.`,
    details: {
      reportNumber: report.reportNumber,
      reportDate: report.header.date,
      projectId,
      projectName,
    },
  };
}

function mergeDailyReportUpdates(input: DailyReportUpsertInput, updates: Record<string, unknown>) {
  const next: DailyReportUpsertInput = {
    ...input,
    header: { ...input.header },
    labor: [...input.labor],
    workCompleted: [...input.workCompleted],
    materials: [...input.materials],
    equipment: [...(input.equipment || [])],
    safety: [...input.safety],
    delays: [...input.delays],
    attachments: [...input.attachments],
    timeline: [...input.timeline],
  };

  const header = asRecord(updates.header);
  if (header) {
    if (typeof header.projectName === "string" && header.projectName.trim()) next.header.projectName = header.projectName.trim();
    if (typeof header.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(header.date)) next.header.date = header.date;
    if (header.shift === "day" || header.shift === "swing" || header.shift === "night") next.header.shift = header.shift;
    if (typeof header.superintendentId === "string") next.header.superintendentId = header.superintendentId;
    if (typeof header.superintendentName === "string") next.header.superintendentName = header.superintendentName;
    if (typeof header.projectManagerName === "string") next.header.projectManagerName = header.projectManagerName;
    if (["sunny", "cloudy", "rain", "storm", "snow", "mixed"].includes(String(header.weather))) {
      next.header.weather = header.weather as DailyReportUpsertInput["header"]["weather"];
    }
    if (typeof header.temperatureF === "number" && Number.isFinite(header.temperatureF)) next.header.temperatureF = header.temperatureF;
    if (["dry", "wet", "muddy", "windy", "frozen", "restricted"].includes(String(header.siteConditions))) {
      next.header.siteConditions = header.siteConditions as DailyReportUpsertInput["header"]["siteConditions"];
    }
  }

  const arrayKeys = ["labor", "workCompleted", "materials", "equipment", "safety", "delays", "attachments", "timeline"] as const;
  for (const key of arrayKeys) {
    if (Array.isArray(updates[key])) {
      (next as unknown as Record<string, unknown>)[key] = updates[key];
    }
  }

  if (typeof updates.aiSummaryVersion === "number" && Number.isInteger(updates.aiSummaryVersion) && updates.aiSummaryVersion > 0) {
    next.aiSummaryVersion = updates.aiSummaryVersion;
  }

  return next;
}

async function executeUpdateDailyReportCommand(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const reportId = requireString(params, "reportId");
  const updates = asRecord(params.updates);
  if (!updates) {
    throw new Error("updates must be an object.");
  }

  const service = createDailyReportsService({ supabaseClient: deps.supabase });
  const current = await service.getReport(reportId);
  if (!current) {
    throw new Error("Daily report was not found.");
  }

  const input = mergeDailyReportUpdates(service.toUpsertInput(current), updates);
  const requestedStatus = typeof updates.status === "string" && DAILY_REPORT_STATUSES.has(updates.status as DailyReportStatus)
    ? updates.status as DailyReportStatus
    : typeof asRecord(updates.header)?.overallStatus === "string" && DAILY_REPORT_STATUSES.has(asRecord(updates.header)?.overallStatus as DailyReportStatus)
      ? asRecord(updates.header)?.overallStatus as DailyReportStatus
      : current.header.overallStatus;

  const report = await service.updateReport(reportId, input, requestedStatus);
  if (!report) {
    throw new Error("Daily report could not be updated.");
  }

  return {
    status: "completed",
    entityType: "daily_report",
    entityId: report.id,
    updatedEntityIds: [report.id],
    publishedEventIds: [],
    href: `/daily-reports/${report.id}`,
    userMessage: `Daily report ${report.reportNumber} was updated.`,
    details: {
      reportNumber: report.reportNumber,
      reportDate: report.header.date,
      projectId: report.header.projectId,
      status: report.header.overallStatus,
    },
  };
}

function applyOperationalDailyReportCommands() {
  const createCommand = ORION_INITIAL_COMMANDS.find((command) => command.id === "daily_report.create");
  if (createCommand) {
    createCommand.coverage = {
      status: "implemented",
      ownerModule: "daily_reports",
      expectedEvent: "daily_report.created",
    };
    createCommand.eventContract = { expectedEvents: ["daily_report.created"] };
    createCommand.validate = validateCreateDailyReport;
    createCommand.execute = executeCreateDailyReportCommand;
  }

  const updateCommand = ORION_INITIAL_COMMANDS.find((command) => command.id === "daily_report.update");
  if (updateCommand) {
    updateCommand.coverage = {
      status: "implemented",
      ownerModule: "daily_reports",
      expectedEvent: "daily_report.updated",
    };
    updateCommand.eventContract = { expectedEvents: ["daily_report.updated"] };
    updateCommand.validate = validateUpdateDailyReport;
    updateCommand.execute = executeUpdateDailyReportCommand;
  }
}

applyOperationalDailyReportCommands();
