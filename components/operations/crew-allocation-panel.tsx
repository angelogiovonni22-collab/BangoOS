import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import type { CrewAllocation } from "@/lib/operations";
import { AlertTriangle, Timer } from "./operations-icons";

type CrewAllocationPanelProps = {
  items: CrewAllocation[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewAllocationPanel({ items, t }: CrewAllocationPanelProps) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("operations.sections.crews")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm font-medium text-[var(--color-text-secondary)]">
            {t("operations.empty.crews")}
          </p>
        ) : (
          items.map((item) => (
            <article key={item.crewId} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Link href={`/crews/${item.crewId}`} className="text-base font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">
                    {item.crewName}
                  </Link>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("operations.crews.lead")}: {item.crewLead}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("operations.crews.assignedProject")}: {item.assignedProject || t("operations.common.unassigned")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(item.status)}>{t(`operations.crewStatus.${item.status}`)}</Badge>
                  <Badge tone={item.availability === "assigned" ? "info" : item.availability === "available" ? "success" : "neutral"}>
                    {t(`operations.crewAvailability.${item.availability}`)}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Info label={t("operations.crews.shift")} value={t(`operations.shift.${item.shift}`)} />
                <Info label={t("operations.crews.startTime")} value={item.startTime} />
                <Info label={t("operations.crews.plannedHours")} value={`${item.plannedHours}`} />
                <Info label={t("operations.crews.utilization")} value={`${item.utilization}%`} />
                <Info label={t("operations.crews.conflicts")} value={`${item.scheduleConflicts}`} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                {item.utilization > 90 ? <Chip text={t("operations.indicator.overloaded")} tone="warning" /> : null}
                {item.availability === "available" ? <Chip text={t("operations.indicator.available")} tone="success" /> : null}
                {item.availability === "off_shift" ? <Chip text={t("operations.indicator.idle")} tone="neutral" /> : null}
                {item.scheduleConflicts > 0 ? <Chip text={t("operations.indicator.conflict")} tone="danger" /> : null}
                {item.certificationWarnings > 0 ? <Chip text={t("operations.indicator.certRisk")} tone="warning" /> : null}
              </div>

              {item.scheduleConflicts > 0 || item.certificationWarnings > 0 ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-warning-700)]">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t("operations.crews.requiresAttention")}
                </p>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  <Timer className="h-3.5 w-3.5" />
                  {t("operations.crews.stable")}
                </p>
              )}
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function statusTone(status: CrewAllocation["status"]) {
  if (status === "on_site") {
    return "success";
  }

  if (status === "available" || status === "in_transit") {
    return "info";
  }

  if (status === "overallocated" || status === "delayed") {
    return "warning";
  }

  return "neutral";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}

function Chip({ text, tone }: { text: string; tone: "success" | "warning" | "danger" | "neutral" }) {
  const className = tone === "success"
    ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]"
    : tone === "warning"
      ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]"
      : tone === "danger"
        ? "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
        : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]";

  return <span className={`rounded-full px-2.5 py-1 ${className}`}>{text}</span>;
}
