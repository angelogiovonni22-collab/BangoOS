import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import type { PriorityActionItem } from "@/lib/operations";

type PriorityActionQueueProps = {
  items: PriorityActionItem[];
};

export function PriorityActionQueue({ items }: PriorityActionQueueProps) {
  return (
    <Card as="section" variant="elevated" className="h-full">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>Priority Action Queue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.length === 0 ? (
          <EmptyState compact icon="!" title="No urgent actions" description="The current focus filter does not have any ranked operational actions." />
        ) : (
          items.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)] transition hover:shadow-[var(--shadow-medium)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">#{index + 1}</span>
                    <Badge tone={severityTone(item.severity)}>{item.severity}</Badge>
                    <Badge tone="info">{item.sourceModule}</Badge>
                  </div>
                  <p className="mt-2 text-base font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.recommendedAction}</p>
                </div>

                <div className="min-w-[220px] space-y-1 text-sm text-[var(--color-text-secondary)]">
                  <p><span className="font-semibold text-[var(--color-text-primary)]">Project:</span> {item.projectName || "Company-wide"}</p>
                  <p><span className="font-semibold text-[var(--color-text-primary)]">Owner:</span> {item.owner || "Unassigned"}</p>
                  <p><span className="font-semibold text-[var(--color-text-primary)]">Due:</span> {item.dueAt || "Not set"}</p>
                  <p><span className="font-semibold text-[var(--color-text-primary)]">Age:</span> {item.ageHours === null ? "Not available" : `${item.ageHours}h`}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function severityTone(severity: PriorityActionItem["severity"]) {
  if (severity === "critical") {
    return "danger";
  }
  if (severity === "high") {
    return "warning";
  }
  if (severity === "medium") {
    return "info";
  }
  return "neutral";
}