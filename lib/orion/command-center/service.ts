import type { SupabaseClient } from "@supabase/supabase-js";
import { createOrionCommandRegistry } from "@/lib/orion/commands/registry";
import type { OrionCommandDefinition, OrionCommandPermission } from "@/lib/orion/commands/types";
import { getOrionNavigationRoutesForRole } from "@/lib/orion/navigation";
import { createOrionTimelineService } from "@/lib/orion/timeline";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { buildWorkspaceContext } from "./workspace-context";
import type {
  OrionCommandCenterAction,
  OrionCommandCenterCatalog,
  OrionCommandCenterGroup,
  OrionCustomerRelatedRecords,
  OrionRelatedRecordItem,
} from "./types";

type RouteContextInput = {
  pathname: string;
  projectId: string | null;
  customerId: string | null;
  estimateId: string | null;
  invoiceId: string | null;
  employeeId: string | null;
  crewId: string | null;
  dashboardWidgetId: string | null;
  timelineItemId: string | null;
};

function normalizeRole(role: string | null): OrionCommandPermission {
  const normalized = (role || "employee").trim().toLowerCase();

  if (normalized === "owner") {
    return "owner";
  }

  if (normalized === "admin" || normalized === "administrator") {
    return "administrator";
  }

  if (normalized === "operations_manager") {
    return "operations_manager";
  }

  if (normalized === "accountant") {
    return "accountant";
  }

  if (normalized === "project_manager") {
    return "project_manager";
  }

  if (normalized === "superintendent") {
    return "superintendent";
  }

  return "employee";
}

function canRunCommand(command: OrionCommandDefinition, role: OrionCommandPermission) {
  return command.requiredPermissions.includes(role);
}

function toEntityLabel(parts: Array<string | null | undefined>, fallback: string) {
  const label = parts.map((part) => (part || "").trim()).filter(Boolean).join(" ");
  return label || fallback;
}

function expectedOutcomeForCommand(command: OrionCommandDefinition) {
  if (command.coverage.status === "unsupported") {
    return command.coverage.reason || "This action is not currently implemented.";
  }

  if (command.id.endsWith(".open") || command.id.endsWith(".view")) {
    return "Open target workspace route.";
  }

  return "Execute Orion command and publish workflow events when applicable.";
}

function buildAction(params: {
  id: string;
  label: string;
  subtitle: string;
  group: OrionCommandCenterGroup;
  command: OrionCommandDefinition;
  deepLink?: string | null;
  params: Record<string, unknown>;
  entityType: string | null;
  entityId: string | null;
  keywords: string[];
  contextTags: string[];
}): OrionCommandCenterAction {
  return {
    id: params.id,
    label: params.label,
    subtitle: params.subtitle,
    group: params.group,
    commandId: params.command.id,
    params: params.params,
    entityType: params.entityType,
    entityId: params.entityId,
    hrefPreview: params.deepLink || null,
    keywords: params.keywords,
    contextTags: params.contextTags,
    requiredPermissions: params.command.requiredPermissions,
    confirmationLevel: params.command.confirmationLevel,
    coverage: params.command.coverage,
    preview: {
      target: params.entityId ? `${params.entityType || "entity"}:${params.entityId}` : (params.deepLink || params.label),
      permission: params.command.requiredPermissions,
      confirmationLevel: params.command.confirmationLevel,
      expectedOutcome: expectedOutcomeForCommand(params.command),
      eventsThatWillPublish: params.command.eventContract?.expectedEvents || [],
    },
  };
}

function addNavigationActions(
  actions: OrionCommandCenterAction[],
  commandsById: Map<string, OrionCommandDefinition>,
  role: OrionCommandPermission,
) {
  const allowedRoutes = getOrionNavigationRoutesForRole(role);

  for (const route of allowedRoutes) {
    const command = commandsById.get(route.commandId);
    if (!command || !canRunCommand(command, role)) {
      continue;
    }

    actions.push(buildAction({
      id: route.id,
      label: `Open ${route.label.toLowerCase()}`,
      subtitle: route.subtitle,
      group: route.group,
      command,
      deepLink: route.href,
      params: {
        entityType: "workflow",
        entityId: route.id,
        deepLink: route.href,
      },
      entityType: "workflow",
      entityId: route.id,
      keywords: route.keywords,
      contextTags: route.contextTags,
    }));
  }
}

function addContextPriorityActions(params: {
  actions: OrionCommandCenterAction[];
  route: RouteContextInput;
  commandsById: Map<string, OrionCommandDefinition>;
}) {
  const { actions, route, commandsById } = params;
  const dashboardOpen = commandsById.get("dashboard.open");

  if (route.projectId && dashboardOpen) {
    const projectId = route.projectId;
    const projectPriorities: Array<{ id: string; label: string; href: string; keywords: string[] }> = [
      { id: "route-project-budget", label: "Open Budget", href: `/projects/${projectId}?tab=budget`, keywords: ["project", "budget"] },
      { id: "route-project-timeline", label: "Open Timeline", href: `/projects/${projectId}?tab=timeline`, keywords: ["project", "timeline"] },
      { id: "route-project-change-order", label: "Create Change Order", href: `/change-orders/new?projectId=${projectId}`, keywords: ["project", "change order"] },
      { id: "route-project-assign-crew", label: "Assign Crew", href: `/crews?projectId=${projectId}`, keywords: ["project", "crew", "assign"] },
      { id: "route-project-daily-report", label: "Daily Report", href: `/daily-reports/new?projectId=${projectId}`, keywords: ["project", "daily report"] },
      { id: "route-project-health", label: "Project Health", href: `/projects/${projectId}?tab=health`, keywords: ["project", "health"] },
      { id: "route-project-photos", label: "Site Photos", href: `/projects/${projectId}?tab=photos`, keywords: ["project", "photos"] },
      { id: "route-project-documents", label: "Project Documents", href: `/projects/${projectId}?tab=documents`, keywords: ["project", "documents"] },
    ];

    for (const priority of projectPriorities) {
      actions.push(buildAction({
        id: priority.id,
        label: priority.label,
        subtitle: `Project focus action for ${projectId.slice(0, 8)}`,
        group: "projects",
        command: dashboardOpen,
        deepLink: priority.href,
        params: {
          entityType: "workflow",
          entityId: projectId,
          deepLink: priority.href,
        },
        entityType: "project",
        entityId: projectId,
        keywords: priority.keywords,
        contextTags: ["project"],
      }));
    }
  }

  if (route.estimateId) {
    const estimateId = route.estimateId;
    const estimateSend = commandsById.get("estimate.send");
    const estimateOpen = commandsById.get("estimate.open");
    const estimateDeposit = commandsById.get("estimate.generate_deposit_invoice");
    const estimateConvert = commandsById.get("estimate.convert");

    if (estimateSend) {
      actions.push(buildAction({
        id: "estimate.send",
        label: "Send Estimate",
        subtitle: `Send estimate ${estimateId.slice(0, 8)}`,
        group: "estimates",
        command: estimateSend,
        params: { estimateId },
        deepLink: `/estimates/${estimateId}`,
        entityType: "estimate",
        entityId: estimateId,
        keywords: ["estimate", "send"],
        contextTags: ["estimate"],
      }));
    }

    if (estimateOpen) {
      actions.push(buildAction({
        id: "route-estimate-preview",
        label: "Preview Estimate",
        subtitle: `Preview estimate ${estimateId.slice(0, 8)}`,
        group: "estimates",
        command: estimateOpen,
        params: { entityType: "estimate", entityId: estimateId, deepLink: `/estimates/${estimateId}` },
        deepLink: `/estimates/${estimateId}`,
        entityType: "estimate",
        entityId: estimateId,
        keywords: ["estimate", "preview"],
        contextTags: ["estimate"],
      }));
    }

    if (dashboardOpen) {
      actions.push(
        buildAction({
          id: "route-estimate-customer-portal",
          label: "Customer Portal",
          subtitle: "Open estimate customer portal",
          group: "estimates",
          command: dashboardOpen,
          params: { entityType: "workflow", entityId: estimateId, deepLink: `/estimates/${estimateId}?tab=portal` },
          deepLink: `/estimates/${estimateId}?tab=portal`,
          entityType: "estimate",
          entityId: estimateId,
          keywords: ["estimate", "portal"],
          contextTags: ["estimate"],
        }),
        buildAction({
          id: "route-estimate-approval-status",
          label: "View Approval Status",
          subtitle: "Open approval workflow details",
          group: "estimates",
          command: dashboardOpen,
          params: { entityType: "workflow", entityId: estimateId, deepLink: `/estimates/${estimateId}?tab=approval-status` },
          deepLink: `/estimates/${estimateId}?tab=approval-status`,
          entityType: "estimate",
          entityId: estimateId,
          keywords: ["estimate", "approval", "status"],
          contextTags: ["estimate"],
        }),
      );
    }

    if (estimateDeposit) {
      actions.push(buildAction({
        id: "estimate.generate_deposit_invoice",
        label: "Generate Deposit Invoice",
        subtitle: "Create deposit invoice from estimate",
        group: "finance",
        command: estimateDeposit,
        params: { estimateId, action: "deposit_invoice" },
        deepLink: `/invoices/new?estimateId=${estimateId}`,
        entityType: "estimate",
        entityId: estimateId,
        keywords: ["estimate", "deposit", "invoice"],
        contextTags: ["estimate"],
      }));
    }

    if (estimateConvert) {
      actions.push(buildAction({
        id: "estimate.convert",
        label: "Convert to Project",
        subtitle: "Convert estimate into project",
        group: "projects",
        command: estimateConvert,
        params: { estimateId, action: "convert" },
        deepLink: `/projects/new?estimateId=${estimateId}`,
        entityType: "estimate",
        entityId: estimateId,
        keywords: ["estimate", "convert", "project"],
        contextTags: ["estimate"],
      }));
    }
  }

  if (route.customerId && dashboardOpen) {
    const customerId = route.customerId;
    const priorities: Array<{ id: string; label: string; href: string; group: OrionCommandCenterGroup; keywords: string[] }> = [
      { id: "route-customer-create-estimate", label: "Create Estimate", href: `/estimates/new?customerId=${customerId}`, group: "estimates", keywords: ["customer", "estimate"] },
      { id: "route-customer-create-project", label: "Create Project", href: `/projects/new?customerId=${customerId}`, group: "projects", keywords: ["customer", "project"] },
      { id: "route-customer-timeline", label: "Open Timeline", href: `/timeline?customerId=${customerId}`, group: "reports", keywords: ["customer", "timeline"] },
      { id: "route-customer-balance", label: "Outstanding Balance", href: `/customers/${customerId}?tab=balance`, group: "finance", keywords: ["customer", "balance"] },
      { id: "route-customer-documents", label: "Documents", href: `/customers/${customerId}?tab=documents`, group: "customers", keywords: ["customer", "documents"] },
      { id: "route-customer-call", label: "Call", href: `/customers/${customerId}?tab=contact`, group: "customers", keywords: ["customer", "call"] },
      { id: "route-customer-email", label: "Email", href: `/customers/${customerId}?tab=contact`, group: "customers", keywords: ["customer", "email"] },
    ];

    for (const priority of priorities) {
      actions.push(buildAction({
        id: priority.id,
        label: priority.label,
        subtitle: `Customer focus action for ${customerId.slice(0, 8)}`,
        group: priority.group,
        command: dashboardOpen,
        deepLink: priority.href,
        params: {
          entityType: "workflow",
          entityId: customerId,
          deepLink: priority.href,
        },
        entityType: "customer",
        entityId: customerId,
        keywords: priority.keywords,
        contextTags: ["customer"],
      }));
    }
  }

  if (route.pathname.startsWith("/dashboard") && dashboardOpen) {
    const priorities: Array<{ id: string; label: string; href: string; group: OrionCommandCenterGroup; keywords: string[] }> = [
      { id: "route-dashboard-priorities", label: "Today's Priorities", href: "/dashboard?widgetId=top-priorities", group: "navigation", keywords: ["dashboard", "priorities"] },
      { id: "route-dashboard-critical-alerts", label: "Critical Alerts", href: "/dashboard?widgetId=critical-alerts", group: "reports", keywords: ["dashboard", "alerts"] },
      { id: "route-dashboard-overdue-estimates", label: "Overdue Estimates", href: "/dashboard?widgetId=estimate-pipeline", group: "estimates", keywords: ["dashboard", "overdue", "estimates"] },
      { id: "route-dashboard-cash-flow", label: "Cash Flow", href: "/dashboard?widgetId=business-health", group: "finance", keywords: ["dashboard", "cash", "flow"] },
      { id: "route-dashboard-recent-activity", label: "Recent Activity", href: "/dashboard?widgetId=activity", group: "reports", keywords: ["dashboard", "activity"] },
    ];

    for (const priority of priorities) {
      actions.push(buildAction({
        id: priority.id,
        label: priority.label,
        subtitle: "Dashboard focus action",
        group: priority.group,
        command: dashboardOpen,
        deepLink: priority.href,
        params: {
          entityType: "workflow",
          entityId: "dashboard",
          deepLink: priority.href,
        },
        entityType: "workflow",
        entityId: "dashboard",
        keywords: priority.keywords,
        contextTags: ["dashboard"],
      }));
    }
  }
}

function dedupeActions(actions: OrionCommandCenterAction[]) {
  const byId = new Map<string, OrionCommandCenterAction>();

  for (const action of actions) {
    if (!byId.has(action.id)) {
      byId.set(action.id, action);
      continue;
    }

    const current = byId.get(action.id);
    if (!current) {
      byId.set(action.id, action);
      continue;
    }

    if (current.contextTags.length < action.contextTags.length) {
      byId.set(action.id, action);
    }
  }

  return [...byId.values()];
}

function toRelatedItems(items: Array<{ id: string; label: string; href: string | null; subtitle: string }>): OrionRelatedRecordItem[] {
  return items;
}

export async function getCustomerRelatedRecords(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  customerId: string;
}): Promise<OrionCustomerRelatedRecords> {
  const { supabase, companyId, customerId } = params;

  const [projectsResult, estimatesResult, invoicesResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("company_id", companyId)
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("estimates")
      .select("id, title, estimate_number, status")
      .eq("company_id", companyId)
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("invoices")
      .select("id, title, invoice_number, status")
      .eq("company_id", companyId)
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const projectIds = (projectsResult.data || []).map((row) => row.id);

  const [photosResult, tasksResult, crewsResult] = await Promise.all([
    projectIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ id: string; project_id: string; created_at: string }>, error: null })
      : supabase
        .from("project_photos")
        .select("id, project_id, created_at")
        .eq("company_id", companyId)
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })
        .limit(8),
    projectIds.length === 0
      ? Promise.resolve({ data: [] as Array<{ id: string; title: string; status: string; project_id: string; task_number: number }>, error: null })
      : supabase
        .from("tasks")
        .select("id, title, status, project_id, task_number")
        .eq("company_id", companyId)
        .in("project_id", projectIds)
        .order("updated_at", { ascending: false })
        .limit(8),
    supabase
      .from("crews")
      .select("id, name, crew_code, status")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const timelineService = createOrionTimelineService(supabase);
  const timeline = await timelineService.listCustomerTimeline(companyId, customerId, { pageSize: 8 });

  return {
    projects: toRelatedItems((projectsResult.data || []).map((row) => ({
      id: row.id,
      label: row.name,
      subtitle: `Project ${row.status}`,
      href: `/projects/${row.id}`,
    }))),
    estimates: toRelatedItems((estimatesResult.data || []).map((row) => ({
      id: row.id,
      label: row.estimate_number ? `${row.estimate_number} ${row.title}` : row.title,
      subtitle: `Estimate ${row.status}`,
      href: `/estimates/${row.id}`,
    }))),
    invoices: toRelatedItems((invoicesResult.data || []).map((row) => ({
      id: row.id,
      label: row.invoice_number ? `${row.invoice_number} ${row.title}` : row.title,
      subtitle: `Invoice ${row.status}`,
      href: `/invoices/${row.id}`,
    }))),
    documents: toRelatedItems(
      timeline.items
        .filter((item) => item.entityType === "document")
        .slice(0, 8)
        .map((item) => ({
          id: item.id,
          label: item.title,
          subtitle: item.summary,
          href: item.href,
        })),
    ),
    timeline: toRelatedItems(timeline.items.map((item) => ({
      id: item.id,
      label: item.title,
      subtitle: item.summary,
      href: item.href,
    }))),
    photos: toRelatedItems((photosResult.data || []).map((row) => ({
      id: row.id,
      label: `Photo ${row.id.slice(0, 8)}`,
      subtitle: `Project ${row.project_id.slice(0, 8)}`,
      href: `/projects/${row.project_id}?tab=photos`,
    }))),
    tasks: toRelatedItems((tasksResult.data || []).map((row) => ({
      id: row.id,
      label: `Task ${row.task_number}: ${row.title}`,
      subtitle: `Task ${row.status}`,
      href: `/operations?taskId=${row.id}`,
    }))),
    crews: toRelatedItems((crewsResult.data || []).map((row) => ({
      id: row.id,
      label: `${row.crew_code} ${row.name}`,
      subtitle: `Crew ${row.status}`,
      href: `/crews/${row.id}`,
    }))),
  };
}

function deriveSuggestedActionIds(actions: OrionCommandCenterAction[], focusArea: string) {
  const focusMatches = actions
    .filter((action) => action.contextTags.includes(focusArea))
    .slice(0, 10)
    .map((action) => action.id);

  if (focusMatches.length > 0) {
    return focusMatches;
  }

  return actions
    .filter((action) => action.group === "navigation")
    .slice(0, 10)
    .map((action) => action.id);
}

function buildRecentTimelineItems(items: Array<{ id: string; title: string; summary: string; href: string | null }>) {
  return items.map((item) => ({
    id: item.id,
    label: item.title,
    subtitle: item.summary,
    href: item.href,
  }));
}

export async function getOrionCommandCenterCatalog(
  supabase: SupabaseClient<Database>,
  workspace: WorkspaceContext,
  route: RouteContextInput,
): Promise<OrionCommandCenterCatalog> {
  const registry = createOrionCommandRegistry();
  const role = normalizeRole(workspace.role);
  const commands = registry.list().filter((command) => canRunCommand(command, role));
  const commandsById = new Map(commands.map((command) => [command.id, command]));

  const context = buildWorkspaceContext({ workspace, route });

  const actions: OrionCommandCenterAction[] = [];
  addNavigationActions(actions, commandsById, role);
  addContextPriorityActions({ actions, route, commandsById });

  const [projects, customers, employees, crews, estimates, invoices, tasks] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, updated_at")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("customers")
      .select("id, first_name, last_name, company_name, status, updated_at")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("employees")
      .select("id, employee_number, position_title, employment_status, updated_at")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("crews")
      .select("id, name, crew_code, status, updated_at")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("estimates")
      .select("id, title, estimate_number, status, updated_at")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("invoices")
      .select("id, title, invoice_number, status, updated_at")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(24),
    supabase
      .from("tasks")
      .select("id, title, task_number, status, project_id, updated_at")
      .eq("company_id", workspace.companyId)
      .order("updated_at", { ascending: false })
      .limit(24),
  ]);

  const projectOpen = commandsById.get("project.open");
  const customerOpen = commandsById.get("customer.open");
  const employeeOpen = commandsById.get("employee.open");
  const crewOpen = commandsById.get("crew.open");
  const estimateOpen = commandsById.get("estimate.open");
  const invoiceOpen = commandsById.get("invoice.open");
  const dashboardOpen = commandsById.get("dashboard.open");

  if (projectOpen) {
    for (const row of projects.data || []) {
      const href = `/projects?projectId=${row.id}`;
      actions.push(buildAction({
        id: `project-${row.id}`,
        label: row.name,
        subtitle: `Project ${row.status}`,
        group: "projects",
        command: projectOpen,
        params: {
          entityType: "project",
          entityId: row.id,
          deepLink: href,
        },
        deepLink: href,
        entityType: "project",
        entityId: row.id,
        keywords: ["project", row.status, row.name],
        contextTags: ["project"],
      }));
    }
  }

  if (customerOpen) {
    for (const row of customers.data || []) {
      const label = toEntityLabel([row.company_name, row.first_name, row.last_name], "Customer");
      const href = `/customers?customerId=${row.id}`;
      actions.push(buildAction({
        id: `customer-${row.id}`,
        label,
        subtitle: `Customer ${row.status}`,
        group: "customers",
        command: customerOpen,
        params: {
          entityType: "customer",
          entityId: row.id,
          deepLink: href,
        },
        deepLink: href,
        entityType: "customer",
        entityId: row.id,
        keywords: ["customer", label, row.status],
        contextTags: ["customer"],
      }));
    }
  }

  if (employeeOpen) {
    for (const row of employees.data || []) {
      const label = `${row.employee_number} - ${row.position_title}`;
      const href = `/employees?employeeId=${row.id}`;
      actions.push(buildAction({
        id: `employee-${row.id}`,
        label,
        subtitle: `Employee ${row.employment_status}`,
        group: "employees",
        command: employeeOpen,
        params: {
          entityType: "employee",
          entityId: row.id,
          deepLink: href,
        },
        deepLink: href,
        entityType: "employee",
        entityId: row.id,
        keywords: ["employee", row.employee_number, row.position_title, row.employment_status],
        contextTags: ["employee"],
      }));
    }
  }

  if (crewOpen) {
    for (const row of crews.data || []) {
      const href = `/crews?crewId=${row.id}`;
      actions.push(buildAction({
        id: `crew-${row.id}`,
        label: row.name,
        subtitle: `Crew ${row.crew_code} ${row.status}`,
        group: "crews",
        command: crewOpen,
        params: {
          entityType: "crew",
          entityId: row.id,
          deepLink: href,
        },
        deepLink: href,
        entityType: "crew",
        entityId: row.id,
        keywords: ["crew", row.name, row.crew_code, row.status],
        contextTags: ["crew"],
      }));
    }
  }

  if (estimateOpen) {
    for (const row of estimates.data || []) {
      const estimateLabel = row.estimate_number ? `${row.estimate_number} ${row.title}` : row.title;
      const href = `/estimates?estimateId=${row.id}`;
      actions.push(buildAction({
        id: `estimate-${row.id}`,
        label: estimateLabel,
        subtitle: `Estimate ${row.status}`,
        group: "estimates",
        command: estimateOpen,
        params: {
          entityType: "estimate",
          entityId: row.id,
          deepLink: href,
        },
        deepLink: href,
        entityType: "estimate",
        entityId: row.id,
        keywords: ["estimate", estimateLabel, row.status],
        contextTags: ["estimate"],
      }));
    }
  }

  if (invoiceOpen) {
    for (const row of invoices.data || []) {
      const invoiceLabel = row.invoice_number ? `${row.invoice_number} ${row.title}` : row.title;
      const href = `/invoices?invoiceId=${row.id}`;
      actions.push(buildAction({
        id: `invoice-${row.id}`,
        label: invoiceLabel,
        subtitle: `Invoice ${row.status}`,
        group: "invoices",
        command: invoiceOpen,
        params: {
          entityType: "invoice",
          entityId: row.id,
          deepLink: href,
        },
        deepLink: href,
        entityType: "invoice",
        entityId: row.id,
        keywords: ["invoice", invoiceLabel, row.status],
        contextTags: ["invoice", "finance"],
      }));
    }
  }

  if (dashboardOpen) {
    for (const row of tasks.data || []) {
      const taskLabel = `Task ${row.task_number}: ${row.title}`;
      const href = `/operations?taskId=${row.id}`;
      actions.push(buildAction({
        id: `task-${row.id}`,
        label: taskLabel,
        subtitle: `Task ${row.status}`,
        group: "reports",
        command: dashboardOpen,
        params: {
          entityType: "workflow",
          entityId: row.id,
          deepLink: href,
        },
        deepLink: href,
        entityType: "task",
        entityId: row.id,
        keywords: ["task", taskLabel, row.status],
        contextTags: ["project", "dashboard"],
      }));
    }
  }

  const dedupedActions = dedupeActions(actions);

  const timelineService = createOrionTimelineService(supabase);
  const timelineResult = route.customerId
    ? await timelineService.listCustomerTimeline(workspace.companyId, route.customerId, { pageSize: 8 })
    : route.projectId
      ? await timelineService.listProjectTimeline(workspace.companyId, route.projectId, { pageSize: 8 })
      : await timelineService.listCompanyTimeline(workspace.companyId, { pageSize: 8 });

  return {
    generatedAt: new Date().toISOString(),
    role,
    context,
    commands: commands.map((command) => ({
      id: command.id,
      name: command.name,
      description: command.description,
      requiredPermissions: command.requiredPermissions,
      confirmationLevel: command.confirmationLevel,
      coverage: command.coverage,
    })),
    actions: dedupedActions,
    suggestedActionIds: deriveSuggestedActionIds(dedupedActions, context.focusArea),
    recentTimeline: buildRecentTimelineItems(
      timelineResult.items.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        href: item.href,
      })),
    ),
  };
}
