import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ProjectTimelineRiskItem } from "@/lib/project-intelligence/types";

type ProjectRiskSummaryProps = {
  risks: ProjectTimelineRiskItem[];
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectRiskSummary({ risks, locale, t }: ProjectRiskSummaryProps) {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-[1.05rem] text-[var(--color-text-primary)]">{t("projects.intelligenceRiskSummaryTitle")}</CardTitle>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("projects.intelligenceRiskSummarySubtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {risks.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t("projects.intelligenceRiskSummaryEmpty")}</p>
        ) : (
          risks.map((risk) => (
            <article key={risk.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(risk.message)}</p>
                <Badge tone={riskTone(risk.severity)}>{t(`projects.intelligencePriority${toTitle(risk.severity)}`)}</Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{formatDate(risk.occurredAt, locale)}</p>
              <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">{t(risk.recommendedAction)}</p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function riskTone(severity: ProjectTimelineRiskItem["severity"]): "neutral" | "warning" | "danger" {
  if (severity === "critical") {
    return "danger";
  }

  if (severity === "high") {
    return "warning";
  }

  return "neutral";
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
