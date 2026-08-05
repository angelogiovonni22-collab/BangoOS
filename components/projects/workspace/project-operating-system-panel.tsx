import Link from "next/link";
import { AlertTriangle, Bot, Gauge, ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ProjectSuperintendentBriefing } from "@/lib/project-intelligence/briefing/briefing-types";
import type { ProjectIntelligence } from "@/lib/project-intelligence/intelligence-types";

type ProjectOperatingSystemPanelProps = {
  intelligence: ProjectIntelligence;
  briefing: ProjectSuperintendentBriefing;
  timelineCount: number;
  formatCurrency: (amount: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectOperatingSystemPanel({ intelligence, briefing, timelineCount, formatCurrency, t }: ProjectOperatingSystemPanelProps) {
  const score = calculateOperatingScore(intelligence, timelineCount);
  const scoreTone = getScoreTone(score);
  const varianceLabel = intelligence.budget.budgetVariance === null
    ? "Budget baseline required"
    : formatCurrency(intelligence.budget.budgetVariance);

  return (
    <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
      <CardHeader className="border-b border-[var(--color-border-subtle)] bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(34,197,94,0.08),rgba(255,255,255,0.95))]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--color-primary-100)] text-[var(--color-brand-700)]">
              <Gauge size={16} aria-hidden="true" />
            </span>
            <CardTitle className="text-[1.15rem] font-bold text-[var(--color-navy-900)]">B.O.S. Project Operating System</CardTitle>
          </div>
          <Badge tone={scoreTone}>{score}/100</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label="Operating Score" value={`${score}/100`} note={scoreSummary(score)} />
          <MetricTile
            label="Delivery Risk"
            value={intelligence.risk.highestSeverity ? toTitleCase(intelligence.risk.highestSeverity) : "Low"}
            note={`${intelligence.risk.totalRisks} active risk signals`}
          />
          <MetricTile
            label="Budget Variance"
            value={varianceLabel}
            note={`${intelligence.budget.overdueInvoices} overdue invoices`}
          />
          <MetricTile
            label="Workflow Coverage"
            value={`${timelineCount} events`}
            note={`${intelligence.quality.photosCount} photos · ${intelligence.summary.activeTasks} active tasks`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-navy-900)]">
              <ShieldCheck size={15} aria-hidden="true" />
              Risk Priorities
            </p>
            <ul className="mt-3 space-y-2">
              {intelligence.risk.risks.length === 0 ? (
                <li className="text-sm text-[var(--color-text-secondary)]">No critical risks are currently flagged.</li>
              ) : (
                intelligence.risk.risks.slice(0, 3).map((risk) => (
                  <li key={risk.id} className="rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">{toTitleCase(risk.severity)}:</span> {risk.message}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-navy-900)]">
              <Bot size={15} aria-hidden="true" />
              Orion Recommended Actions
            </p>
            <ul className="mt-3 space-y-2">
              {briefing.recommendedActions.length === 0 ? (
                <li className="text-sm text-[var(--color-text-secondary)]">No recommended actions yet. Continue tracking project updates.</li>
              ) : (
                briefing.recommendedActions.slice(0, 3).map((action) => (
                  <li key={action.id} className="rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(action.titleKey)}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t(action.explanationKey)}</p>
                    {action.href ? (
                      <Link href={action.href} className="mt-2 inline-flex text-xs font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                        Open action
                      </Link>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {intelligence.summary.overdueTasks > 0 || intelligence.summary.blockedTasks > 0 ? (
          <div className="flex items-start gap-2 rounded-[12px] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2.5 text-sm text-[var(--color-warning-800)]">
            <AlertTriangle size={15} className="mt-0.5" aria-hidden="true" />
            <p>
              Immediate attention: {intelligence.summary.overdueTasks} overdue tasks and {intelligence.summary.blockedTasks} blocked tasks are reducing operating stability.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{note}</p>
    </div>
  );
}

function calculateOperatingScore(intelligence: ProjectIntelligence, timelineCount: number) {
  const healthBase = intelligence.summary.healthScore ?? 52;
  const overduePenalty = Math.min(25, intelligence.summary.overdueTasks * 3);
  const blockedPenalty = Math.min(18, intelligence.summary.blockedTasks * 2);
  const riskPenalty = intelligence.risk.highestSeverity === "critical"
    ? 20
    : intelligence.risk.highestSeverity === "high"
      ? 12
      : intelligence.risk.highestSeverity === "medium"
        ? 6
        : 0;
  const timelineBonus = Math.min(8, Math.floor(timelineCount / 4));
  const documentationBonus = intelligence.quality.documentationPresent ? 4 : 0;

  return clampScore(healthBase - overduePenalty - blockedPenalty - riskPenalty + timelineBonus + documentationBonus);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getScoreTone(score: number): "brand" | "success" | "warning" | "danger" | "neutral" {
  if (score >= 85) {
    return "success";
  }

  if (score >= 70) {
    return "brand";
  }

  if (score >= 55) {
    return "warning";
  }

  return "danger";
}

function scoreSummary(score: number) {
  if (score >= 85) {
    return "Healthy operating posture";
  }

  if (score >= 70) {
    return "Stable with minor watch items";
  }

  if (score >= 55) {
    return "Attention recommended this week";
  }

  return "Recovery actions needed now";
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
