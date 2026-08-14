import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import type { LiveProjectStatusRow } from "@/lib/operations";

type LiveProjectStatusProps = {
  items: LiveProjectStatusRow[];
};

export function LiveProjectStatus({ items }: LiveProjectStatusProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>Live Project Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {items.length === 0 ? (
          <EmptyState compact icon="P" title="No active projects" description="No company projects are currently marked as active." />
        ) : (
          items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="block rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)] transition hover:shadow-[var(--shadow-medium)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            >
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-[var(--color-text-primary)]">{item.projectName}</p>
                    <Badge tone={riskTone(item.riskLevel)}>{item.riskLevel} risk</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.customerName}</p>
                </div>

                <div className="grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Health" value={`${item.healthScore}/100`} />
                  <Metric label="Phase" value={item.currentPhase} />
                  <Metric label="Progress" value={`${item.progressPercent}%`} />
                  <Metric label="Assigned workforce" value={String(item.assignedWorkerCount ?? 0)} />
                  <Metric label="Overdue tasks" value={String(item.overdueTaskCount)} />
                  <Metric label="Blocked tasks" value={String(item.blockedTaskCount)} />
                  <Metric label="Latest activity" value={item.latestActivityAt || "Unavailable"} />
                  <Metric label="Next milestone" value={item.nextMilestone || "Unavailable"} />
                </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function riskTone(level: LiveProjectStatusRow["riskLevel"]) {
  if (level === "high") {
    return "danger";
  }
  if (level === "medium") {
    return "warning";
  }
  return "success";
}