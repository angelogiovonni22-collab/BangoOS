import type { OrionCommandPermission } from "@/lib/orion/commands";
import type { OrionCommandCenterGroup } from "@/lib/orion/command-center/types";
import type { OrionIntentEntityType, OrionIntentKind } from "@/lib/orion/intent-engine/types";

export type OrionNavigationCommandId = "dashboard.open" | "schedule.open";

export type OrionSidebarNavigationGroup = {
  key: string;
  label: string;
  items: Array<{
    key: string;
    href: string;
    icon: string;
  }>;
};

export type OrionNavigationRoute = {
  id: string;
  navKey: string;
  label: string;
  subtitle: string;
  href: string;
  commandId: OrionNavigationCommandId;
  group: OrionCommandCenterGroup;
  keywords: string[];
  contextTags: string[];
  requiredRoles?: OrionCommandPermission[];
};

type OrionDeterministicNavigationRoute = {
  routeId: string;
  aliases: string[];
  commandId?: string;
  resolvedIntent: OrionIntentKind;
  entityType: OrionIntentEntityType;
  entityId: string;
  confidence: number;
  deepLink?: string;
};

const TEAM_ROLES: OrionCommandPermission[] = [
  "owner",
  "administrator",
  "operations_manager",
  "project_manager",
  "superintendent",
  "accountant",
  "employee",
];

const MANAGEMENT_ROLES: OrionCommandPermission[] = [
  "owner",
  "administrator",
  "operations_manager",
  "project_manager",
  "superintendent",
  "accountant",
];

export const ORION_NAVIGATION_ROUTES: OrionNavigationRoute[] = [
  {
    id: "route-dashboard",
    navKey: "dashboard",
    label: "Dashboard",
    subtitle: "Go to the executive dashboard",
    href: "/dashboard",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["dashboard", "home", "overview", "bos"],
    contextTags: ["general", "dashboard"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-operations",
    navKey: "operations",
    label: "Operations",
    subtitle: "Go to operations overview",
    href: "/operations",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["operations", "ops", "command center"],
    contextTags: ["general", "project", "dashboard"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-timeline",
    navKey: "timeline",
    label: "Timeline",
    subtitle: "Go to Orion timeline",
    href: "/timeline",
    commandId: "dashboard.open",
    group: "reports",
    keywords: ["timeline", "events", "history", "activity"],
    contextTags: ["general", "project", "customer", "dashboard"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-dispatch",
    navKey: "dispatch",
    label: "Dispatch Center",
    subtitle: "Go to dispatch board",
    href: "/dispatch",
    commandId: "dashboard.open",
    group: "scheduling",
    keywords: ["dispatch", "crew board", "assignment"],
    contextTags: ["general", "project", "operations"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-schedule",
    navKey: "schedule",
    label: "Schedule",
    subtitle: "Go to scheduling board",
    href: "/schedule",
    commandId: "schedule.open",
    group: "scheduling",
    keywords: ["schedule", "calendar", "plan"],
    contextTags: ["general", "project", "operations"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-daily-reports",
    navKey: "dailyReports",
    label: "Daily Reports",
    subtitle: "Go to daily reports workspace",
    href: "/daily-reports",
    commandId: "dashboard.open",
    group: "reports",
    keywords: ["daily reports", "field reports", "logs"],
    contextTags: ["general", "project", "operations"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-projects",
    navKey: "projects",
    label: "Projects",
    subtitle: "Go to projects workspace",
    href: "/projects",
    commandId: "dashboard.open",
    group: "projects",
    keywords: ["projects", "portfolio", "jobs"],
    contextTags: ["general", "project"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-blueprints",
    navKey: "blueprints",
    label: "Blueprints",
    subtitle: "Go to the blueprint plan room",
    href: "/blueprints",
    commandId: "dashboard.open",
    group: "projects",
    keywords: ["blueprints", "plans", "drawings", "plan room", "sheets"],
    contextTags: ["general", "project"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-estimates",
    navKey: "estimates",
    label: "Estimates",
    subtitle: "Go to estimate pipeline",
    href: "/estimates",
    commandId: "dashboard.open",
    group: "estimates",
    keywords: ["estimates", "proposals", "quotes"],
    contextTags: ["general", "estimate", "customer"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-invoices",
    navKey: "invoices",
    label: "Invoices",
    subtitle: "Go to invoice center",
    href: "/invoices",
    commandId: "dashboard.open",
    group: "invoices",
    keywords: ["invoices", "billing", "payments"],
    contextTags: ["general", "invoice", "finance"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-change-orders",
    navKey: "changeOrders",
    label: "Change Orders",
    subtitle: "Go to change orders",
    href: "/change-orders",
    commandId: "dashboard.open",
    group: "projects",
    keywords: ["change orders", "scope changes", "co"],
    contextTags: ["general", "project"],
    requiredRoles: MANAGEMENT_ROLES,
  },
  {
    id: "route-labor-rates",
    navKey: "laborRates",
    label: "Labor Rates",
    subtitle: "Go to labor rates",
    href: "/labor-rates",
    commandId: "dashboard.open",
    group: "finance",
    keywords: ["labor rates", "rates", "labor"],
    contextTags: ["general", "finance"],
    requiredRoles: MANAGEMENT_ROLES,
  },
  {
    id: "route-customers",
    navKey: "customers",
    label: "Customers",
    subtitle: "Go to customer directory",
    href: "/customers",
    commandId: "dashboard.open",
    group: "customers",
    keywords: ["customers", "clients", "crm"],
    contextTags: ["general", "customer"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-materials",
    navKey: "materials",
    label: "Materials",
    subtitle: "Go to materials catalog",
    href: "/materials",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["materials", "inventory", "supplies"],
    contextTags: ["general", "operations"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-units-of-measure",
    navKey: "unitsOfMeasure",
    label: "Units of Measure",
    subtitle: "Go to unit definitions",
    href: "/units-of-measure",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["units", "uom", "measurements"],
    contextTags: ["general", "operations"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-equipment",
    navKey: "equipment",
    label: "Equipment",
    subtitle: "Go to equipment workspace",
    href: "/equipment",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["equipment", "assets", "machines"],
    contextTags: ["general", "operations"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-vendors",
    navKey: "vendors",
    label: "Vendors",
    subtitle: "Go to vendor directory",
    href: "/vendors",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["vendors", "suppliers"],
    contextTags: ["general", "operations"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-employees",
    navKey: "employees",
    label: "Employees",
    subtitle: "Go to employee directory",
    href: "/employees",
    commandId: "dashboard.open",
    group: "employees",
    keywords: ["employees", "workforce", "staff"],
    contextTags: ["general", "employee"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-crews",
    navKey: "crew",
    label: "Crew",
    subtitle: "Go to crew workspace",
    href: "/crews",
    commandId: "dashboard.open",
    group: "crews",
    keywords: ["crew", "crews", "team", "teams"],
    contextTags: ["general", "crew", "project"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-team",
    navKey: "employees",
    label: "Team",
    subtitle: "Go to team workspace",
    href: "/team",
    commandId: "dashboard.open",
    group: "settings",
    keywords: ["team", "company team", "directory"],
    contextTags: ["general", "employee"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-settings",
    navKey: "settings",
    label: "Settings",
    subtitle: "Go to workspace settings",
    href: "/settings",
    commandId: "dashboard.open",
    group: "settings",
    keywords: ["settings", "preferences", "configuration"],
    contextTags: ["general", "settings"],
    requiredRoles: MANAGEMENT_ROLES,
  },
  {
    id: "route-settings-memory-review",
    navKey: "settings",
    label: "Memory Review",
    subtitle: "Go to memory review settings",
    href: "/settings/memory-review",
    commandId: "dashboard.open",
    group: "settings",
    keywords: ["memory review", "orion memory", "settings memory"],
    contextTags: ["general", "settings"],
    requiredRoles: MANAGEMENT_ROLES,
  },
  {
    id: "route-cost-codes",
    navKey: "operations",
    label: "Cost Codes",
    subtitle: "Go to cost code library",
    href: "/cost-codes",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["cost codes", "codes", "cost tracking"],
    contextTags: ["general", "operations", "project"],
    requiredRoles: TEAM_ROLES,
  },
  {
    id: "route-labs-mission-control",
    navKey: "operations",
    label: "Operations Overview Lab",
    subtitle: "Go to operations overview lab",
    href: "/labs/mission-control",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["labs", "operations overview", "experimental"],
    contextTags: ["general"],
    requiredRoles: MANAGEMENT_ROLES,
  },
  {
    id: "route-labs-orion-core",
    navKey: "operations",
    label: "Orion Core Lab",
    subtitle: "Go to Orion core lab",
    href: "/labs/orion-core",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["labs", "orion core", "experimental"],
    contextTags: ["general"],
    requiredRoles: MANAGEMENT_ROLES,
  },
  {
    id: "route-labs-quantum",
    navKey: "operations",
    label: "Quantum Lab",
    subtitle: "Go to quantum lab",
    href: "/labs/quantum",
    commandId: "dashboard.open",
    group: "navigation",
    keywords: ["labs", "quantum", "experimental"],
    contextTags: ["general"],
    requiredRoles: MANAGEMENT_ROLES,
  },
];

export const ORION_SIDEBAR_NAVIGATION_GROUPS: OrionSidebarNavigationGroup[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    items: [{ key: "dashboard", href: "/dashboard", icon: "◉" }],
  },
  {
    key: "operations",
    label: "Operations",
    items: [
      { key: "operations", href: "/operations", icon: "◈" },
      { key: "timeline", href: "/timeline", icon: "◔" },
      { key: "dispatch", href: "/dispatch", icon: "⌁" },
      { key: "dailyReports", href: "/daily-reports", icon: "◨" },
      { key: "schedule", href: "/schedule", icon: "◑" },
      { key: "projects", href: "/projects", icon: "◍" },
      { key: "blueprints", href: "/blueprints", icon: "▧" },
    ],
  },
  {
    key: "financial",
    label: "Financial",
    items: [
      { key: "estimates", href: "/estimates", icon: "◎" },
      { key: "invoices", href: "/invoices", icon: "◐" },
      { key: "changeOrders", href: "/change-orders", icon: "◔" },
      { key: "laborRates", href: "/labor-rates", icon: "◈" },
    ],
  },
  {
    key: "resources",
    label: "Resources",
    items: [
      { key: "customers", href: "/customers", icon: "◌" },
      { key: "materials", href: "/materials", icon: "◉" },
      { key: "unitsOfMeasure", href: "/units-of-measure", icon: "◍" },
      { key: "equipment", href: "/equipment", icon: "◍" },
      { key: "vendors", href: "/vendors", icon: "◇" },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    items: [
      { key: "employees", href: "/employees", icon: "◒" },
      { key: "crew", href: "/crews", icon: "◒" },
      { key: "settings", href: "/settings", icon: "◓" },
    ],
  },
];

const ORION_DETERMINISTIC_NAVIGATION: OrionDeterministicNavigationRoute[] = [
  {
    routeId: "route-dashboard",
    aliases: [
      "dashboard",
      "home",
      "go home",
      "main dashboard",
      "executive dashboard",
    ],
    resolvedIntent: "show_dashboard",
    entityType: "dashboard",
    entityId: "dashboard",
    confidence: 0.98,
  },
  {
    routeId: "route-dashboard",
    aliases: ["go back", "back", "previous page", "open previous page"],
    commandId: "navigation.back",
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "navigation-back",
    confidence: 0.98,
    deepLink: "/dashboard",
  },
  {
    routeId: "route-operations",
    aliases: ["operations", "operations center", "ops", "ops center"],
    resolvedIntent: "navigation",
    entityType: "operations",
    entityId: "operations",
    confidence: 0.97,
  },
  {
    routeId: "route-projects",
    aliases: ["projects", "project list", "project workspace"],
    resolvedIntent: "open",
    entityType: "workflow",
    entityId: "projects",
    confidence: 0.96,
  },
  {
    routeId: "route-blueprints",
    aliases: ["blueprints", "blueprint", "plans", "drawings", "plan room", "construction drawings"],
    resolvedIntent: "open",
    entityType: "workflow",
    entityId: "blueprints",
    confidence: 0.97,
  },
  {
    routeId: "route-estimates",
    aliases: ["estimates", "estimate pipeline", "quotes"],
    resolvedIntent: "open",
    entityType: "workflow",
    entityId: "estimates",
    confidence: 0.96,
  },
  {
    routeId: "route-customers",
    aliases: ["customers", "customer directory", "clients", "crm"],
    resolvedIntent: "open",
    entityType: "workflow",
    entityId: "customers",
    confidence: 0.96,
  },
  {
    routeId: "route-timeline",
    aliases: ["timeline", "activity timeline", "activity history"],
    resolvedIntent: "show_timeline",
    entityType: "timeline",
    entityId: "timeline",
    confidence: 0.97,
  },
  {
    routeId: "route-dispatch",
    aliases: ["dispatch", "dispatch center", "dispatch board"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "dispatch",
    confidence: 0.96,
  },
  {
    routeId: "route-schedule",
    aliases: ["schedule", "scheduling", "calendar", "today schedule", "todays schedule", "today's schedule"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "schedule",
    confidence: 0.97,
  },
  {
    routeId: "route-invoices",
    aliases: ["invoices", "invoice center", "billing"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "invoices",
    confidence: 0.96,
  },
  {
    routeId: "route-employees",
    aliases: ["employees", "employee directory", "staff"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "employees",
    confidence: 0.96,
  },
  {
    routeId: "route-crews",
    aliases: ["crew", "crews", "team crews"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "crews",
    confidence: 0.96,
  },
  {
    routeId: "route-settings",
    aliases: ["settings", "workspace settings", "preferences"],
    resolvedIntent: "navigation",
    entityType: "settings",
    entityId: "settings",
    confidence: 0.95,
  },
  {
    routeId: "route-team",
    aliases: ["team", "company team"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "team",
    confidence: 0.95,
  },
  {
    routeId: "route-vendors",
    aliases: ["vendors", "supplier directory", "suppliers"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "vendors",
    confidence: 0.95,
  },
  {
    routeId: "route-materials",
    aliases: ["materials", "material list", "inventory materials"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "materials",
    confidence: 0.95,
  },
  {
    routeId: "route-units-of-measure",
    aliases: ["units of measure", "uom", "units"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "units-of-measure",
    confidence: 0.95,
  },
  {
    routeId: "route-equipment",
    aliases: ["equipment", "equipment list", "assets"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "equipment",
    confidence: 0.95,
  },
  {
    routeId: "route-daily-reports",
    aliases: ["daily reports", "daily report", "field reports", "reports", "reporting"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "daily-reports",
    confidence: 0.95,
  },
  {
    routeId: "route-change-orders",
    aliases: ["change orders", "change order"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "change-orders",
    confidence: 0.95,
  },
  {
    routeId: "route-cost-codes",
    aliases: ["cost codes", "cost code library"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "cost-codes",
    confidence: 0.95,
  },
  {
    routeId: "route-labor-rates",
    aliases: ["labor rates", "labor rate table"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "labor-rates",
    confidence: 0.95,
  },
  {
    routeId: "route-labs-mission-control",
    aliases: ["mission control", "labs mission control"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "labs-mission-control",
    confidence: 0.95,
  },
  {
    routeId: "route-labs-orion-core",
    aliases: ["orion core lab", "orion core"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "labs-orion-core",
    confidence: 0.95,
  },
  {
    routeId: "route-labs-quantum",
    aliases: ["quantum lab", "labs quantum"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "labs-quantum",
    confidence: 0.95,
  },
  {
    routeId: "route-settings-memory-review",
    aliases: ["memory review", "settings memory review", "orion memory review"],
    resolvedIntent: "navigation",
    entityType: "workflow",
    entityId: "settings-memory-review",
    confidence: 0.95,
  },
];

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeDeterministicSubject(input: string) {
  const normalized = compact(input)
    .replace(/^(open|show me|show|go to|go|take me to|bring up|bring me to|navigate to)\s+/, "")
    .replace(/^(the|up)\s+/, "")
    .trim();

  return normalized;
}

export function getOrionNavigationRouteById(routeId: string) {
  return ORION_NAVIGATION_ROUTES.find((route) => route.id === routeId) || null;
}

export function getOrionNavigationRoutesForRole(role: OrionCommandPermission) {
  return ORION_NAVIGATION_ROUTES.filter((route) => !route.requiredRoles || route.requiredRoles.includes(role));
}

function normalizeStaticPath(value: string) {
  const pathname = value.trim().split(/[?#]/, 1)[0] || "";
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  return (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname).toLowerCase();
}

export function resolveCanonicalOrionNavigationHref(input: { entityId: string; deepLink?: string | null }) {
  const requestedPath = input.deepLink ? normalizeStaticPath(input.deepLink) : null;
  const requestedRoute = requestedPath
    ? ORION_NAVIGATION_ROUTES.find((route) => normalizeStaticPath(route.href) === requestedPath)
    : null;

  const normalizedEntityId = input.entityId.trim().toLowerCase();
  const entityRoute = ORION_NAVIGATION_ROUTES.find((route) => (
    route.id.toLowerCase() === normalizedEntityId
    || route.id.toLowerCase() === `route-${normalizedEntityId}`
    || route.navKey.toLowerCase() === normalizedEntityId
    || normalizeStaticPath(route.href) === `/${normalizedEntityId.replace(/^route-/, "")}`
  ));

  const route = requestedRoute || entityRoute;
  if (!route) return null;

  const query = input.deepLink?.includes("?") && requestedRoute
    ? `?${input.deepLink.split("?", 2)[1].split("#", 1)[0]}`
    : "";
  return `${route.href}${query}`;
}

export function resolveDeterministicNavigationRoute(input: string) {
  const normalizedSubject = normalizeDeterministicSubject(input);

  if (!normalizedSubject) {
    return null;
  }

  for (const entry of ORION_DETERMINISTIC_NAVIGATION) {
    const route = getOrionNavigationRouteById(entry.routeId);
    if (!route) {
      continue;
    }

    const matches = entry.aliases.some((alias) => compact(alias) === normalizedSubject);
    if (!matches) {
      continue;
    }

    const isTodaySchedule = normalizedSubject === "today schedule" || normalizedSubject === "todays schedule" || normalizedSubject === "today's schedule";
    const deepLink = entry.deepLink || (isTodaySchedule && route.id === "route-schedule" ? "/schedule?range=today" : route.href);
    const commandId = entry.commandId || route.commandId;

    return {
      commandId,
      resolvedIntent: entry.resolvedIntent,
      entityType: entry.entityType,
      entityId: entry.entityId,
      deepLink,
      confidence: entry.confidence,
    };
  }

  return null;
}
