import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { AttentionItem, AttentionScope } from "@/lib/operations";

type AttentionQueueProps = {
  items: AttentionItem[];
  scope: AttentionScope;
  onScopeChange: (scope: AttentionScope) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const scopeOptions: AttentionScope[] = ["all", "critical", "today", "projects", "crews", "workforce", "safety"];

export function AttentionQueue({ items, scope, onScopeChange, t }: AttentionQueueProps) {
  return (
    <Card as="section">
      <CardHeader className="space-y-3">
        <CardTitle>{t("operations.sections.attention")}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {scopeOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onScopeChange(option)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${scope === option ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white" : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"}`}
            >
              {t(`operations.attentionScope.${option}`)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm font-medium text-[var(--color-text-secondary)]">
            {t("operations.empty.attention")}
          </p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.reason}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {item.relatedEntity} · {item.owner} · {formatDateTime(item.dueAt)}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">{item.suggestedAction}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={priorityTone(item.priority)}>{t(`operations.severity.${item.priority}`)}</Badge>
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

function priorityTone(priority: AttentionItem["priority"]) {
  if (priority === "critical") {
    return "danger";
  }

  if (priority === "high") {
    return "warning";
  }

  if (priority === "medium") {
    return "info";
  }

  return "neutral";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
