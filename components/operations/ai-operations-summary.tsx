import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { OperationsInsight } from "@/lib/operations";
import { Bot, Sparkles } from "./operations-icons";

type AiOperationsSummaryProps = {
  items: OperationsInsight[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function AiOperationsSummary({ items, t }: AiOperationsSummaryProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Bot className="h-5 w-5 text-[var(--color-brand-700)]" />
          {t("operations.sections.aiSummary")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-info-200)] bg-[var(--color-info-50)] px-3 py-2 text-sm font-medium text-[var(--color-info-700)]">
          {t("operations.ai.mockNotice")}
        </p>

        {items.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-semibold text-[var(--color-text-primary)]">{t(item.title)}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t(item.explanation)}</p>
                <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">
                  {t("operations.ai.nextAction")} {t(item.recommendedAction)}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {t("operations.ai.related")} {item.relatedEntity}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={severityTone(item.severity)}>{t(`operations.severity.${item.severity}`)}</Badge>
                <Badge tone="info">{t(`operations.insightCategory.${item.category}`)}</Badge>
              </div>
            </div>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)]">
              <Sparkles className="h-3.5 w-3.5" />
              {t(item.confidence)}
            </p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

function severityTone(severity: OperationsInsight["severity"]) {
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
