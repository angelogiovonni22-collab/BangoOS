import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { SchedulingInsight } from "@/lib/scheduling";
import { Bot, Sparkles } from "./scheduling-icons";

type SchedulingAiAssistantProps = {
  insights: SchedulingInsight[];
  onAccept: (insightId: string) => void;
  onDismiss: (insightId: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function SchedulingAiAssistant({ insights, onAccept, onDismiss, t }: SchedulingAiAssistantProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-2">
          <Bot className="h-5 w-5 text-[var(--color-brand-700)]" />
          {t("scheduling.ai.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-info-200)] bg-[var(--color-info-50)] px-3 py-2 text-sm text-[var(--color-info-700)]">
          {t("scheduling.ai.mockNotice")}
        </p>

        {insights.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
              <Badge tone={item.severity === "critical" ? "danger" : item.severity === "high" ? "warning" : "info"}>{t(`scheduling.severity.${item.severity}`)}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.explanation}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.expectedImpact}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
              <Sparkles className="h-3.5 w-3.5" />
              {t("scheduling.ai.confidence", { value: Math.round(item.confidence * 100) })}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onAccept(item.id)}>{t("scheduling.ai.accept")}</Button>
              <Button size="sm" variant="outline" onClick={() => onDismiss(item.id)}>{t("scheduling.ai.dismiss")}</Button>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
