import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import type { PendingDecisionItem } from "@/lib/operations";

type PendingDecisionsProps = {
  items: PendingDecisionItem[];
};

export function PendingDecisions({ items }: PendingDecisionsProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>Pending Decisions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.length === 0 ? (
          <EmptyState compact icon="D" title="No pending decisions" description="There are no outstanding approval or reassignment items in the current view." />
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)] transition hover:shadow-[var(--shadow-medium)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                    <Badge tone={tone(item.severity)}>{item.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.projectName || "Company-wide"}</p>
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  <p><span className="font-semibold text-[var(--color-text-primary)]">Owner:</span> {item.owner || "Unassigned"}</p>
                  <p><span className="font-semibold text-[var(--color-text-primary)]">Due:</span> {item.dueAt || "Not set"}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function tone(severity: PendingDecisionItem["severity"]) {
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