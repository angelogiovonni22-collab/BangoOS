"use client";

import { BusinessGraphProvider } from "./BusinessGraphProvider";
import { BusinessGraphCanvas } from "./BusinessGraphCanvas";
import { GraphLegend } from "./GraphLegend";
import { NodeInspector } from "./NodeInspector";
import { RelationshipEngineFromExecutive } from "./RelationshipEngine";
import type { ExecutiveDashboardData } from "@/lib/dashboard/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

type ExecutiveRelationshipViewProps = {
  companyName: string;
  data: ExecutiveDashboardData;
};

export function ExecutiveRelationshipView({ companyName, data }: ExecutiveRelationshipViewProps) {
  const { graph, signals } = RelationshipEngineFromExecutive(data, companyName);

  return (
    <BusinessGraphProvider graph={graph}>
      <Card as="section" variant="elevated" className="overflow-hidden">
        <CardHeader className="bg-[var(--color-surface-subtle)]/70">
          <CardTitle>Executive Relationship View</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Signal label="Highest-risk project" value={signals.highestRiskProject || "None"} tone="danger" />
            <Signal label="Blocked dependencies" value={String(signals.blockedDependencies)} tone="warning" />
            <Signal label="Invoice bottlenecks" value={String(signals.invoiceBottlenecks)} tone="warning" />
            <Signal label="Crew conflicts" value={String(signals.crewConflicts)} tone="danger" />
            <Signal label="Schedule conflicts" value={String(signals.scheduleConflicts)} tone="info" />
          </div>

          <GraphLegend />
          <BusinessGraphCanvas className="bf-depth-surface" />
          <NodeInspector title="Relationship Inspector" />
        </CardContent>
      </Card>
    </BusinessGraphProvider>
  );
}

function Signal({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "warning" | "danger" | "info";
}) {
  const toneClass = tone === "danger"
    ? "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
    : tone === "warning"
      ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]"
      : "bg-[var(--color-info-50)] text-[var(--color-info-700)]";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
