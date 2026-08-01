"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deriveSpatialRouteState } from "./SpatialNavigationProvider";

type DepartmentNavigatorProps = {
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function DepartmentNavigator({ t }: DepartmentNavigatorProps) {
  const pathname = usePathname();
  const route = deriveSpatialRouteState(pathname || "/dashboard");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={route.departmentHref}
        className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
      >
        {route.departmentLabel}
      </Link>
      <span className="rounded-full bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-700)]">
        {route.surfaceKind === "mission-control" ? t("navigation.dashboard") : route.moduleLabel}
      </span>
    </div>
  );
}