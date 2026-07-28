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
    <Card as="section" className="overflow-hidden border-white/20 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(30,41,59,0.95))] text-white">
      <CardHeader className="border-white/10">
        <CardTitle className="text-white">{t("dashboard.commandCenterTitle")}</CardTitle>
        <CardDescription className="text-slate-300">{t("dashboard.commandCenterDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {isLoading ? (
          <CommandCenterLoadingState />
        ) : sorted.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-white/15 bg-white/5 p-4 text-sm text-slate-300">
            {t("dashboard.commandCenterEmpty")}
          </p>
        ) : (
          sorted.map((recommendation) => (
            <article key={recommendation.id} className="rounded-[var(--radius-xl)] border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                    {recommendation.icon}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                      {t(`dashboard.priority${toTitle(recommendation.priority)}`)}
                    </p>
                    <p className="mt-1 text-sm text-slate-100">{t(recommendation.messageKey)}</p>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatRelativeMinutes(recommendation.timestampMinutesAgo, t)}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {recommendation.actions.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    size="sm"
                    variant={toButtonVariant(action.intent)}
                    className={action.intent === "primary" ? "bg-blue-500 text-white hover:bg-blue-600" : ""}
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
      <SkeletonLoader className="h-24 w-full bg-white/10" />
      <SkeletonLoader className="h-24 w-full bg-white/10" />
      <SkeletonLoader className="h-24 w-full bg-white/10" />
    </div>
  );
}
