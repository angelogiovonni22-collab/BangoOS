import { useMemo } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, SkeletonLoader } from "@/components/ui";
import type { AIRecommendation } from "@/lib/dashboard/types";

type AICommandCenterProps = {
  recommendations: AIRecommendation[];
  isLoading?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function AICommandCenter({ recommendations, isLoading = false, t }: AICommandCenterProps) {
  const sorted = useMemo(
    () => [...recommendations].sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority)),
    [recommendations],
  );

  return (
    <Card as="section" variant="elevated" className="overflow-hidden">
      <CardHeader className="bg-[var(--color-surface-subtle)]/70">
        <CardTitle>{t("dashboard.commandCenterTitle")}</CardTitle>
        <CardDescription>{t("dashboard.commandCenterDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {isLoading ? (
          <CommandCenterLoadingState />
        ) : sorted.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.commandCenterEmpty")}
          </p>
        ) : (
          sorted.map((recommendation) => (
            <article key={recommendation.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-[var(--color-brand-700)] bg-[var(--color-primary-50)]">
                    {recommendation.icon}
                  </span>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${priorityTone(recommendation.priority)}`}>
                      {t(`dashboard.priority${toTitle(recommendation.priority)}`)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-primary)]">{t(recommendation.messageKey)}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">{formatRelativeMinutes(recommendation.timestampMinutesAgo, t)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {recommendation.actions.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    size="sm"
                    variant={toButtonVariant(action.intent)}
                    className={action.intent === "primary" ? "bg-[var(--color-brand-600)] text-white hover:bg-[var(--color-brand-700)]" : ""}
                    aria-label={t(action.labelKey)}
                  >
                    {t(action.labelKey)}
                  </Button>
                ))}
              </div>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function priorityWeight(priority: AIRecommendation["priority"]) {
  if (priority === "critical") {
    return 0;
  }

  if (priority === "high") {
    return 1;
  }

  if (priority === "medium") {
    return 2;
  }

  return 3;
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toButtonVariant(intent: "primary" | "secondary" | "ghost") {
  if (intent === "primary") {
    return "primary";
  }

  if (intent === "secondary") {
    return "outline";
  }

  return "ghost";
}

function priorityTone(priority: AIRecommendation["priority"]) {
  if (priority === "critical") {
    return "text-[var(--color-danger-700)]";
  }

  if (priority === "high") {
    return "text-[var(--color-warning-700)]";
  }

  if (priority === "medium") {
    return "text-[var(--color-brand-700)]";
  }

  return "text-[var(--color-text-muted)]";
}

function formatRelativeMinutes(minutesAgo: number, t: (key: string, params?: Record<string, string | number>) => string) {
  if (minutesAgo < 60) {
    return `${minutesAgo}m ${t("dashboard.activityAgo")}`;
  }

  const hours = Math.floor(minutesAgo / 60);

  if (hours < 24) {
    return `${hours}h ${t("dashboard.activityAgo")}`;
  }

  return `${Math.floor(hours / 24)}d ${t("dashboard.activityAgo")}`;
}

function CommandCenterLoadingState() {
  return (
    <div className="space-y-3">
      <SkeletonLoader className="h-24 w-full" />
      <SkeletonLoader className="h-24 w-full" />
      <SkeletonLoader className="h-24 w-full" />
    </div>
  );
}
