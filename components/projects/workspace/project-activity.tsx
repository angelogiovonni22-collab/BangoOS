import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { WorkspaceActivityItem } from "./types";

type ProjectActivityProps = {
  title: string;
  items: WorkspaceActivityItem[];
  emptyLabel: string;
  viewLabel: string;
};

export function ProjectActivity({ title, items, emptyLabel, viewLabel }: ProjectActivityProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/50">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {emptyLabel}
          </p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.detail}</p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">{item.timestamp}</p>
                </div>
                <span className={getToneClass(item.tone)} aria-hidden="true" />
              </div>
              {item.href ? (
                <Link href={item.href} className="mt-3 inline-flex text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                  {viewLabel}
                </Link>
              ) : null}
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function getToneClass(tone: WorkspaceActivityItem["tone"]) {
  const map: Record<WorkspaceActivityItem["tone"], string> = {
    blue: "mt-1 h-3 w-3 rounded-full bg-[var(--color-brand-600)]",
    green: "mt-1 h-3 w-3 rounded-full bg-[var(--color-success-500)]",
    amber: "mt-1 h-3 w-3 rounded-full bg-[var(--color-warning-500)]",
    indigo: "mt-1 h-3 w-3 rounded-full bg-[var(--color-info-500)]",
    analytics: "mt-1 h-3 w-3 rounded-full bg-[var(--color-analytics-500)]",
    slate: "mt-1 h-3 w-3 rounded-full bg-[var(--color-neutral-400)]",
  };

  return map[tone];
}
