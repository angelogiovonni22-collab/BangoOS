export const COMPANY_ROLES = [
  "owner",
  "administrator",
  "operations_manager",
  "project_manager",
  "estimator",
  "superintendent",
  "office_manager",
  "accountant",
  "foreman",
  "employee",
  "subcontractor",
  "customer",
] as const;

export type CompanyRole = (typeof COMPANY_ROLES)[number];

export type BosPermission =
  | "dashboard.view"
  | "operations.view"
  | "projects.view"
  | "projects.manage"
  | "project_financials.view"
  | "schedule.view"
  | "schedule.manage"
  | "daily_reports.view"
  | "daily_reports.manage"
  | "blueprints.view"
  | "blueprints.manage"
  | "photos.view"
  | "photos.manage"
  | "communications.view"
  | "communications.manage"
  | "scope.view"
  | "customers.view"
  | "customers.manage"
  | "estimates.view"
  | "estimates.manage"
  | "invoices.view"
  | "invoices.manage"
  | "change_orders.view"
  | "change_orders.manage"
  | "labor_rates.view"
  | "labor_rates.manage"
  | "workforce.view"
  | "workforce.manage"
  | "equipment.view"
  | "equipment.manage"
  | "materials.view"
  | "materials.manage"
  | "vendors.view"
  | "vendors.manage"
  | "settings.view"
  | "settings.manage"
  | "access_control.manage"
  | "subcontractor_portal.view"
  | "customer_portal.view";

const ALL_PERMISSIONS: BosPermission[] = [
  "dashboard.view", "operations.view", "projects.view", "projects.manage", "project_financials.view",
  "schedule.view", "schedule.manage", "daily_reports.view", "daily_reports.manage",
  "blueprints.view", "blueprints.manage", "photos.view", "photos.manage",
  "communications.view", "communications.manage", "scope.view", "customers.view", "customers.manage",
  "estimates.view", "estimates.manage", "invoices.view", "invoices.manage",
  "change_orders.view", "change_orders.manage", "labor_rates.view", "labor_rates.manage",
  "workforce.view", "workforce.manage", "equipment.view", "equipment.manage",
  "materials.view", "materials.manage", "vendors.view", "vendors.manage",
  "settings.view", "settings.manage", "access_control.manage", "subcontractor_portal.view", "customer_portal.view",
];

const ROLE_PERMISSIONS: Record<CompanyRole, readonly BosPermission[]> = {
  owner: ALL_PERMISSIONS,
  administrator: ALL_PERMISSIONS,
  operations_manager: ALL_PERMISSIONS.filter((permission) => permission !== "access_control.manage"),
  project_manager: [
    "dashboard.view", "operations.view", "projects.view", "projects.manage", "project_financials.view",
    "schedule.view", "schedule.manage", "daily_reports.view", "daily_reports.manage",
    "blueprints.view", "blueprints.manage", "photos.view", "photos.manage",
    "communications.view", "communications.manage", "scope.view", "customers.view", "customers.manage",
    "estimates.view", "estimates.manage", "invoices.view", "change_orders.view", "change_orders.manage",
    "workforce.view", "workforce.manage", "equipment.view", "equipment.manage", "materials.view", "materials.manage",
    "vendors.view",
  ],
  estimator: [
    "projects.view", "project_financials.view", "customers.view", "customers.manage",
    "estimates.view", "estimates.manage", "blueprints.view", "scope.view", "materials.view", "vendors.view",
  ],
  superintendent: [
    "operations.view", "projects.view", "schedule.view", "schedule.manage", "daily_reports.view", "daily_reports.manage",
    "blueprints.view", "blueprints.manage", "photos.view", "photos.manage", "communications.view", "communications.manage",
    "scope.view", "workforce.view", "workforce.manage", "equipment.view", "equipment.manage", "materials.view", "vendors.view",
  ],
  office_manager: [
    "dashboard.view", "operations.view", "projects.view", "project_financials.view", "schedule.view", "schedule.manage",
    "daily_reports.view", "communications.view", "communications.manage", "customers.view", "customers.manage",
    "estimates.view", "estimates.manage", "invoices.view", "invoices.manage", "change_orders.view", "labor_rates.view",
    "workforce.view", "vendors.view", "vendors.manage", "settings.view",
  ],
  accountant: [
    "dashboard.view", "projects.view", "project_financials.view", "customers.view",
    "estimates.view", "invoices.view", "invoices.manage", "change_orders.view", "labor_rates.view", "labor_rates.manage",
    "vendors.view",
  ],
  foreman: [
    "operations.view", "projects.view", "schedule.view", "daily_reports.view", "daily_reports.manage",
    "blueprints.view", "photos.view", "photos.manage", "communications.view", "communications.manage",
    "scope.view", "workforce.view", "equipment.view", "materials.view",
  ],
  employee: [
    "projects.view", "schedule.view", "daily_reports.view", "daily_reports.manage", "blueprints.view",
    "photos.view", "photos.manage", "communications.view", "communications.manage", "scope.view",
    "workforce.view", "equipment.view",
  ],
  subcontractor: [
    "subcontractor_portal.view", "scope.view", "schedule.view", "blueprints.view",
    "photos.view", "photos.manage", "communications.view", "communications.manage",
  ],
  customer: ["customer_portal.view", "scope.view", "schedule.view", "photos.view", "communications.view"],
};

export type PermissionOverrides = Partial<Record<BosPermission, boolean>>;

export function normalizeCompanyRole(role: string | null | undefined): CompanyRole {
  const normalized = (role || "employee").trim().toLowerCase();
  return COMPANY_ROLES.includes(normalized as CompanyRole) ? normalized as CompanyRole : "employee";
}

export function hasBosPermission(
  role: string | null | undefined,
  permission: BosPermission,
  overrides?: PermissionOverrides | null,
) {
  if (overrides && typeof overrides[permission] === "boolean") return Boolean(overrides[permission]);
  return ROLE_PERMISSIONS[normalizeCompanyRole(role)].includes(permission);
}

export function getRoleHomePath(role: string | null | undefined) {
  switch (normalizeCompanyRole(role)) {
    case "subcontractor": return "/partner";
    case "customer": return "/customer-portal";
    case "employee":
    case "foreman": return "/crews/field";
    case "superintendent": return "/projects";
    case "estimator": return "/estimates";
    case "accountant": return "/invoices";
    default: return "/dashboard";
  }
}

type RouteRule = { prefix: string; permission: BosPermission };

const ROUTE_RULES: RouteRule[] = [
  { prefix: "/settings/access-control", permission: "access_control.manage" },
  { prefix: "/settings", permission: "settings.view" },
  { prefix: "/trade-partner-messages", permission: "communications.view" },
  { prefix: "/labor-rates", permission: "labor_rates.view" },
  { prefix: "/invoices", permission: "invoices.view" },
  { prefix: "/estimates", permission: "estimates.view" },
  { prefix: "/change-orders", permission: "change_orders.view" },
  { prefix: "/customers", permission: "customers.view" },
  { prefix: "/employees", permission: "workforce.view" },
  { prefix: "/team", permission: "workforce.view" },
  { prefix: "/crews", permission: "workforce.view" },
  { prefix: "/equipment", permission: "equipment.view" },
  { prefix: "/materials", permission: "materials.view" },
  { prefix: "/units-of-measure", permission: "materials.view" },
  { prefix: "/vendors", permission: "vendors.view" },
  { prefix: "/blueprints", permission: "blueprints.view" },
  { prefix: "/daily-reports", permission: "daily_reports.view" },
  { prefix: "/schedule", permission: "schedule.view" },
  { prefix: "/dispatch", permission: "operations.view" },
  { prefix: "/timeline", permission: "operations.view" },
  { prefix: "/operations", permission: "operations.view" },
  { prefix: "/projects", permission: "projects.view" },
  { prefix: "/dashboard", permission: "dashboard.view" },
  { prefix: "/partner", permission: "subcontractor_portal.view" },
  { prefix: "/customer-portal", permission: "customer_portal.view" },
];

export function permissionForPath(pathname: string): BosPermission | null {
  const rule = ROUTE_RULES.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return rule?.permission ?? null;
}

export function canAccessPath(role: string | null | undefined, pathname: string, overrides?: PermissionOverrides | null) {
  const permission = permissionForPath(pathname);
  return permission ? hasBosPermission(role, permission, overrides) : true;
}

export function isFinancialPermission(permission: BosPermission) {
  return [
    "project_financials.view", "estimates.view", "estimates.manage", "invoices.view", "invoices.manage",
    "change_orders.view", "change_orders.manage", "labor_rates.view", "labor_rates.manage",
  ].includes(permission);
}
