import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ProjectCrewAssignmentSummary } from "@/lib/crews";

type ProjectCrewSummaryProps = {
  title: string;
  items: ProjectCrewAssignmentSummary[];
  fallbackLabel: string;
  viewLabel: string;
};

export function ProjectCrewSummary({ title, items, fallbackLabel, viewLabel }: ProjectCrewSummaryProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/50">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {fallbackLabel}
          </p>
        ) : (
          items.map((item) => (
            <article key={item.crewId} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.crewName}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.role}</p>
                  <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                    {item.actualManpower}/{item.estimatedManpower} {item.allocationPercentage}%
                  </p>
                </div>
                <span className="rounded-full bg-[var(--color-brand-50)] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-700)]">
                  {item.allocationPercentage}%
                </span>
              </div>
              <Link href="/team" className="mt-3 inline-flex text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                {viewLabel}
              </Link>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}
