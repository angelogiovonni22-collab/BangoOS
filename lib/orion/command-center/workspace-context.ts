import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { OrionWorkspaceContext } from "./types";

type WorkspaceRouteInputs = {
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

function routePageName(pathname: string) {
  if (pathname.startsWith("/dashboard")) {
    return "Dashboard";
  }

  if (pathname.startsWith("/projects")) {
    return "Projects";
  }

  if (pathname.startsWith("/customers") || pathname.startsWith("/crm")) {
    return "Customers";
  }

  if (pathname.startsWith("/estimates")) {
    return "Estimates";
  }

  if (pathname.startsWith("/invoices")) {
    return "Invoices";
  }

  if (pathname.startsWith("/employees")) {
    return "Employees";
  }

  if (pathname.startsWith("/crews")) {
    return "Crews";
  }

  if (pathname.startsWith("/timeline")) {
    return "Timeline";
  }

  if (pathname.startsWith("/operations")) {
    return "Operations";
  }

  return "Workspace";
}

function focusAreaFromRoute(input: WorkspaceRouteInputs): OrionWorkspaceContext["focusArea"] {
  if (input.projectId || input.pathname.startsWith("/projects")) {
    return "project";
  }

  if (input.estimateId || input.pathname.startsWith("/estimates")) {
    return "estimate";
  }

  if (input.customerId || input.pathname.startsWith("/customers") || input.pathname.startsWith("/crm")) {
    return "customer";
  }

  if (input.invoiceId || input.pathname.startsWith("/invoices")) {
    return "invoice";
  }

  if (input.employeeId || input.pathname.startsWith("/employees")) {
    return "employee";
  }

  if (input.crewId || input.pathname.startsWith("/crews")) {
    return "crew";
  }

  if (input.pathname.startsWith("/dashboard")) {
    return "dashboard";
  }

  return "general";
}

function toDisplayLabel(id: string | null, prefix: string) {
  if (!id) {
    return null;
  }

  return {
    id,
    label: `${prefix} ${id.slice(0, 8)}`,
  };
}

export function buildWorkspaceContext(params: {
  workspace: WorkspaceContext;
  route: WorkspaceRouteInputs;
}): OrionWorkspaceContext {
  const { workspace, route } = params;

  return {
    currentPage: routePageName(route.pathname),
    currentRoute: route.pathname,
    currentProject: toDisplayLabel(route.projectId, "Project"),
    currentCustomer: toDisplayLabel(route.customerId, "Customer"),
    currentEstimate: toDisplayLabel(route.estimateId, "Estimate"),
    currentInvoice: toDisplayLabel(route.invoiceId, "Invoice"),
    currentEmployee: toDisplayLabel(route.employeeId, "Employee"),
    currentCrew: toDisplayLabel(route.crewId, "Crew"),
    currentDashboardWidget: route.dashboardWidgetId,
    currentTimelineItem: route.timelineItemId,
    currentCompany: {
      id: workspace.companyId,
      label: workspace.companyName || "Company",
    },
    currentAuthenticatedUser: {
      id: workspace.userId,
      label: workspace.userId,
    },
    focusArea: focusAreaFromRoute(route),
  };
}

export function parseRouteContext(url: URL) {
  const pathname = url.pathname;
  const search = url.searchParams;

  const parseEntityId = (key: string, routePrefix: string) => {
    const byQuery = search.get(key);
    if (byQuery && byQuery.trim()) {
      return byQuery.trim();
    }

    const match = pathname.match(new RegExp(`^/${routePrefix}/([^/?#]+)`));
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }

    return null;
  };

  return {
    pathname,
    projectId: parseEntityId("projectId", "projects"),
    customerId: parseEntityId("customerId", "customers"),
    estimateId: parseEntityId("estimateId", "estimates"),
    invoiceId: parseEntityId("invoiceId", "invoices"),
    employeeId: parseEntityId("employeeId", "employees"),
    crewId: parseEntityId("crewId", "crews"),
    dashboardWidgetId: search.get("widgetId"),
    timelineItemId: search.get("timelineItemId") || search.get("eventId"),
  };
}
