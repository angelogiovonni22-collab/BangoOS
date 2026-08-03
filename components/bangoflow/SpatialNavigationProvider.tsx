"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export type SpatialSurfaceKind = "mission-control" | "module" | "workspace";
export type SpatialDepartment = "dashboard" | "operations" | "financial" | "resources" | "administration";

export type SpatialBreadcrumb = {
  id: string;
  label: string;
  href: string | null;
};

export type SpatialRouteState = {
  pathname: string;
  surfaceKind: SpatialSurfaceKind;
  department: SpatialDepartment;
  departmentLabel: string;
  departmentHref: string;
  moduleKey: string;
  moduleLabel: string;
  transitionKey: string;
  breadcrumbs: SpatialBreadcrumb[];
};

type SpatialNavigationContextValue = SpatialRouteState;

const SpatialNavigationContext = createContext<SpatialNavigationContextValue | null>(null);

type SpatialNavigationProviderProps = {
  children: ReactNode;
};

const DEPARTMENT_LOOKUP: Record<string, { department: SpatialDepartment; label: string; href: string }> = {
  dashboard: { department: "dashboard", label: "Mission Control", href: "/dashboard" },
  operations: { department: "operations", label: "Operations", href: "/operations" },
  scheduling: { department: "operations", label: "Operations", href: "/operations" },
  dispatch: { department: "operations", label: "Operations", href: "/operations" },
  "daily-reports": { department: "operations", label: "Operations", href: "/operations" },
  schedule: { department: "operations", label: "Operations", href: "/operations" },
  projects: { department: "operations", label: "Operations", href: "/operations" },
  estimates: { department: "financial", label: "Financial", href: "/estimates" },
  invoices: { department: "financial", label: "Financial", href: "/invoices" },
  "change-orders": { department: "financial", label: "Financial", href: "/change-orders" },
  "labor-rates": { department: "financial", label: "Financial", href: "/labor-rates" },
  customers: { department: "resources", label: "Resources", href: "/customers" },
  materials: { department: "resources", label: "Resources", href: "/materials" },
  "units-of-measure": { department: "resources", label: "Resources", href: "/units-of-measure" },
  equipment: { department: "resources", label: "Resources", href: "/equipment" },
  vendors: { department: "resources", label: "Resources", href: "/vendors" },
  employees: { department: "administration", label: "Administration", href: "/employees" },
  crews: { department: "administration", label: "Administration", href: "/crews" },
  settings: { department: "administration", label: "Administration", href: "/settings" },
};

export function deriveSpatialRouteState(pathname: string): SpatialRouteState {
  const normalized = pathname || "/dashboard";
  const segments = normalized.split("/").filter(Boolean);
  const moduleKey = segments[0] || "dashboard";
  const lookup = DEPARTMENT_LOOKUP[moduleKey] ?? DEPARTMENT_LOOKUP.dashboard;
  const surfaceKind: SpatialSurfaceKind = normalized === "/dashboard"
    ? "mission-control"
    : moduleKey === "projects" && segments.length > 1
      ? "workspace"
      : "module";

  const moduleLabel = surfaceKind === "mission-control"
    ? "Mission Control"
    : surfaceKind === "workspace"
      ? "Project Workspace"
      : moduleKey === "dispatch"
        ? "Dispatch Center"
      : toTitle(moduleKey.replace(/-/g, " "));

  return {
    pathname: normalized,
    surfaceKind,
    department: lookup.department,
    departmentLabel: lookup.label,
    departmentHref: lookup.href,
    moduleKey,
    moduleLabel,
    transitionKey: `${lookup.department}:${surfaceKind}:${segments.slice(0, surfaceKind === "workspace" ? 2 : 1).join("/") || "dashboard"}`,
    breadcrumbs: buildBreadcrumbs(segments, surfaceKind),
  };
}

export function SpatialNavigationProvider({ children }: SpatialNavigationProviderProps) {
  const pathname = usePathname();
  const value = useMemo(() => deriveSpatialRouteState(pathname || "/dashboard"), [pathname]);
  return <SpatialNavigationContext.Provider value={value}>{children}</SpatialNavigationContext.Provider>;
}

export function useSpatialNavigation() {
  const context = useContext(SpatialNavigationContext);
  if (!context) {
    throw new Error("useSpatialNavigation must be used within SpatialNavigationProvider.");
  }

  return context;
}

function buildBreadcrumbs(segments: string[], surfaceKind: SpatialSurfaceKind): SpatialBreadcrumb[] {
  if (segments.length === 0 || (segments.length === 1 && segments[0] === "dashboard")) {
    return [
      { id: "dashboard", label: "Mission Control", href: null },
    ];
  }

  const items: SpatialBreadcrumb[] = [
    { id: "dashboard", label: "Mission Control", href: "/dashboard" },
  ];

  let accumulated = "";
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    accumulated += `/${segment}`;
    const isLast = index === segments.length - 1;
    const isWorkspaceDetail = surfaceKind === "workspace" && index === 1;
    const label = isWorkspaceDetail
      ? "Workspace"
      : toTitle(segment.replace(/-/g, " "));

    items.push({
      id: `${segment}-${index}`,
      label,
      href: isLast ? null : accumulated,
    });
  }

  return items;
}

function toTitle(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}