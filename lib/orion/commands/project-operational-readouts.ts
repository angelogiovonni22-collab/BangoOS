import { getOperationsCommandCenter } from "@/lib/operations/command-center-service";
import { ORION_INITIAL_COMMANDS } from "./registry";
import type {
  OrionCommandDependencies,
  OrionCommandExecutionContext,
  OrionCommandExecutionOutput,
  OrionCommandPermission,
  OrionCommandValidationResult,
} from "./types";

const TEAM_ROLES: OrionCommandPermission[] = [
  "owner",
  "administrator",
  "operations_manager",
  "project_manager",
  "superintendent",
  "accountant",
  "employee",
];

function validateProjectId(params: unknown): OrionCommandValidationResult {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return { ok: false, errors: ["projectId is required."] };
  }

  const row = params as Record<string, unknown>;
  const projectId = typeof row.projectId === "string" ? row.projectId.trim() : "";
  return {
    ok: Boolean(projectId),
    errors: projectId ? [] : ["projectId is required."],
    normalizedParams: projectId ? { ...row, projectId } : undefined,
  };
}

function requireProjectId(params: Record<string, unknown>) {
  const projectId = typeof params.projectId === "string" ? params.projectId.trim() : "";
  if (!projectId) {
    throw new Error("projectId is required.");
  }

  return projectId;
}

async function loadOperations(
  deps: OrionCommandDependencies,
  context: OrionCommandExecutionContext,
) {
  return getOperationsCommandCenter(
    deps.supabase,
    {
      userId: context.actorProfileId || "orion",
      companyId: context.companyId,
      role: context.request.userContext.role,
      companyName: null,
      companySlug: null,
      membershipId: null,
      membershipStatus: null,
    },
    "en-US",
    (key) => key,
  );
}

async function executeProjectWorkforceSummary(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const projectId = requireProjectId(params);
  const operations = await loadOperations(deps, context);
  const project = operations.data.projectStatus.find((row) => row.id === projectId);
  if (!project) {
    throw new Error("Project workforce data is unavailable for the selected project.");
  }

  const assigned = operations.data.workforceBoard.filter((row) => row.assignedProject === project.projectName);
  const names = assigned.map((row) => row.fullName).filter(Boolean);
  const taskDetails = assigned
    .filter((row) => row.currentTask)
    .slice(0, 5)
    .map((row) => `${row.fullName}: ${row.currentTask}`);

  const count = project.assignedWorkerCount ?? names.length;
  const namesSummary = names.length > 0
    ? ` Assigned team: ${names.slice(0, 8).join(", ")}${names.length > 8 ? `, plus ${names.length - 8} more` : ""}.`
    : " No team members are currently assigned in the live workforce board.";
  const taskSummary = taskDetails.length > 0 ? ` Current work: ${taskDetails.join("; ")}.` : "";
  const message = `${project.projectName} has ${count} assigned worker${count === 1 ? "" : "s"}.${namesSummary}${taskSummary}`;

  return {
    status: "completed",
    entityType: "project",
    entityId: project.id,
    href: `/projects/${project.id}?tab=crew`,
    userMessage: message,
    details: {
      assignedWorkerCount: count,
      assignedWorkers: names,
      currentWork: taskDetails,
    },
  };
}

async function executeProjectChangeOrderSummary(
  params: Record<string, unknown>,
  context: OrionCommandExecutionContext,
  deps: OrionCommandDependencies,
): Promise<OrionCommandExecutionOutput> {
  const projectId = requireProjectId(params);
  const operations = await loadOperations(deps, context);
  const project = operations.data.projectStatus.find((row) => row.id === projectId);
  if (!project) {
    throw new Error("Project change order data is unavailable for the selected project.");
  }

  const pending = operations.data.pendingDecisions.filter((row) => row.decisionType === "change_order" && row.projectName === project.projectName);
  const titles = pending.map((row) => row.title).filter(Boolean);
  const message = pending.length === 0
    ? `${project.projectName} has no outstanding change order decisions in the live operations queue.`
    : `${project.projectName} has ${pending.length} outstanding change order${pending.length === 1 ? "" : "s"}: ${titles.slice(0, 5).join("; ")}${titles.length > 5 ? `; plus ${titles.length - 5} more` : ""}.`;

  return {
    status: "completed",
    entityType: "project",
    entityId: project.id,
    href: `/projects/${project.id}?tab=change-orders`,
    userMessage: message,
    details: {
      outstandingChangeOrderCount: pending.length,
      outstandingChangeOrders: pending.map((row) => ({
        id: row.id,
        title: row.title,
        severity: row.severity,
        dueAt: row.dueAt,
      })),
    },
  };
}

function registerProjectOperationalReadouts() {
  if (!ORION_INITIAL_COMMANDS.some((command) => command.id === "project.workforce_summary")) {
    ORION_INITIAL_COMMANDS.push({
      id: "project.workforce_summary",
      name: "Read Project Workforce",
      description: "Read the live workforce assigned to a project.",
      requiredPermissions: TEAM_ROLES,
      entityType: "project",
      confirmationLevel: "NONE",
      coverage: { status: "implemented", ownerModule: "workforce" },
      inputSchema: "{ projectId: string }",
      undoCapable: false,
      validate: validateProjectId,
      execute: executeProjectWorkforceSummary,
    });
  }

  if (!ORION_INITIAL_COMMANDS.some((command) => command.id === "project.change_order_summary")) {
    ORION_INITIAL_COMMANDS.push({
      id: "project.change_order_summary",
      name: "Read Project Change Orders",
      description: "Read outstanding project change order decisions from live operations data.",
      requiredPermissions: TEAM_ROLES,
      entityType: "project",
      confirmationLevel: "NONE",
      coverage: { status: "implemented", ownerModule: "change_orders" },
      inputSchema: "{ projectId: string }",
      undoCapable: false,
      validate: validateProjectId,
      execute: executeProjectChangeOrderSummary,
    });
  }
}

registerProjectOperationalReadouts();
