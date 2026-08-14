import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { WorkspaceMilestoneItem } from "./types";

type ProjectMilestonesProps = {
  title: string;
  items: WorkspaceMilestoneItem[];
  emptyLabel: string;
  viewLabel: string;
};

export function ProjectMilestones({ title, items, emptyLabel, viewLabel }: ProjectMilestonesProps) {
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
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">{item.dateLabel}</p>
                </div>
                <span className={`inline-flex h-2.5 w-2.5 rounded-full ${getToneClass(item.tone)}`} aria-hidden="true" />
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

function getToneClass(tone: WorkspaceMilestoneItem["tone"]) {
  const map: Record<WorkspaceMilestoneItem["tone"], string> = {
    blue: "bg-[var(--color-brand-600)]",
    green: "bg-[var(--color-success-500)]",
    amber: "bg-[var(--color-warning-500)]",
    indigo: "bg-[var(--color-info-500)]",
    analytics: "bg-[var(--color-analytics-500)]",
    slate: "bg-[var(--color-neutral-400)]",
    danger: "bg-[var(--color-danger-500)]",
  };

  return map[tone];
}
