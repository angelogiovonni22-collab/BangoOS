import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, PartialDataNotice } from "@/components/ui";
import type { ExecutiveBrief } from "@/lib/orion/executive-brief-types";

type OrionOperationsBriefProps = {
  brief: ExecutiveBrief | null;
};

export function OrionOperationsBrief({ brief }: OrionOperationsBriefProps) {
  if (!brief) {
    return (
      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]/40">
          <CardTitle>Orion Operations Brief</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <EmptyState compact icon="O" title="Orion brief unavailable" description="The deterministic executive brief could not be composed from the current supported inputs." />
        </CardContent>
      </Card>
    );
  }

  const topPriority = brief.priorityItems[0] || null;
  const projectLikelyToSlip = brief.priorityItems.find((item) => item.category === "schedule" || item.category === "operations") || null;
  const workforceConcern = brief.limitations.find((item) => item.message.toLowerCase().includes("attendance")) || null;
  const financialDependency = brief.priorityItems.find((item) => item.category === "budget") || null;

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Orion Operations Brief</CardTitle>
          <Badge tone={brief.readinessState === "ready" ? "success" : brief.readinessState === "attention" ? "warning" : "info"}>{brief.readinessState}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        {brief.limitations.length > 0 ? <PartialDataNotice message={brief.limitations[0].message} /> : null}

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <BriefItem label="Biggest operational risk" value={topPriority?.description || "Unavailable"} />
          <BriefItem label="Most urgent owner action" value={topPriority?.title || "Unavailable"} />
          <BriefItem label="Project likely to slip" value={projectLikelyToSlip?.title || "Unavailable"} />
          <BriefItem label="Crew or scheduling concern" value={workforceConcern?.message || "Unavailable"} />
          <BriefItem label="Financial-operational dependency" value={financialDependency?.description || "Unavailable"} />
          <BriefItem label="Recommended next owner move" value={brief.companySummary.headline} />
        </div>
      </CardContent>
    </Card>
  );
}

function BriefItem({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </article>
  );
}