"use client";

import Link from "next/link";
import { useSpatialNavigation } from "./SpatialNavigationProvider";

export function NavigationBreadcrumb() {
  const { breadcrumbs } = useSpatialNavigation();

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
      {breadcrumbs.map((item, index) => (
        <span key={item.id} className="flex items-center gap-2">
          {item.href ? (
            <Link href={item.href} className="font-medium text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]">
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[var(--color-text-primary)]">{item.label}</span>
          )}
          {index < breadcrumbs.length - 1 ? <span>/</span> : null}
        </span>
      ))}
    </nav>
  );
}