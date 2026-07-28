import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { SafetyAlert } from "@/lib/operations";

type SafetyCompliancePanelProps = {
  items: SafetyAlert[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function SafetyCompliancePanel({ items, t }: SafetyCompliancePanelProps) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("operations.sections.safety")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm font-medium text-[var(--color-text-secondary)]">
            {t("operations.empty.safety")}
          </p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.project} · {item.subject}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {t("operations.safety.owner")}: {item.owner} · {t("operations.safety.dueDate")}: {formatDate(item.dueDate)}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">{item.recommendedAction}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={severityTone(item.severity)}>{t(`operations.severity.${item.severity}`)}</Badge>
                  <Badge tone={item.status === "resolved" ? "success" : item.status === "in_progress" ? "info" : "warning"}>
                    {t(`operations.alertStatus.${item.status}`)}
                  </Badge>
                </div>
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function severityTone(severity: SafetyAlert["severity"]) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
