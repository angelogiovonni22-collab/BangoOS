import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PartialDataNotice } from "@/components/ui";
import type { DataAvailability, WorkforceBoardRow } from "@/lib/operations";

type WorkforceBoardProps = {
  items: WorkforceBoardRow[];
  availability: DataAvailability;
};

export function WorkforceBoard({ items, availability }: WorkforceBoardProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>Crew and Workforce Board</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {availability === "partial" ? (
          <PartialDataNotice message="Showing live task ownership and estimated hours. Crew assignments, conflicts, and time-entry coverage are not fully available from a live service yet." />
        ) : null}

        {items.length === 0 ? (
          <EmptyState compact icon="W" title="No workforce assignments" description="No active task owners were detected for the current company." />
        ) : (
          items.slice(0, 10).map((item) => (
            <Link
              key={item.profileId}
              href={item.href}
              className="block rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)] transition hover:shadow-[var(--shadow-medium)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-[var(--color-text-primary)]">{item.fullName}</p>
                    <Badge tone={item.status === "overloaded" ? "warning" : item.status === "assigned" ? "success" : "neutral"}>{item.status}</Badge>
                    {item.hasConflict ? <Badge tone="warning">Multiple active tasks</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.assignedProject || "Unassigned to a project"}</p>
                </div>

                <div className="grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Current task" value={item.currentTask || "Unavailable"} />
                  <Metric label="Phase" value={item.currentPhase || "Unavailable"} />
                  <Metric label="Scheduled hours" value={item.scheduledHours === null ? "Unavailable" : `${item.scheduledHours}h`} />
                  <Metric label="Time logged" value={item.timeLoggedHours === null ? "Unavailable" : `${item.timeLoggedHours}h`} />
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