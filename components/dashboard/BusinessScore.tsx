import { useMemo, useState } from "react";
import { AnimatedProgress, CountUp } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, SkeletonLoader } from "@/components/ui";
import type { AIBusinessScoreSnapshot, BusinessHealthSummary } from "@/lib/dashboard/types";

type BusinessScoreProps = {
  snapshot: AIBusinessScoreSnapshot | null;
  summary?: BusinessHealthSummary | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function BusinessScore({ snapshot, summary = null, isLoading = false, errorMessage = null, t }: BusinessScoreProps) {
  const [expanded, setExpanded] = useState(false);

  const normalizedScore = useMemo(() => {
    if (!snapshot) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(snapshot.score)));
  }, [snapshot]);

  if (isLoading) {
    return (
      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]/40">
          <CardTitle>{t("dashboard.businessScoreTitle")}</CardTitle>
          <CardDescription>{t("dashboard.businessScoreDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <SkeletonLoader className="h-28 w-28 rounded-full" />
          <SkeletonLoader className="h-5 w-40" />
          <SkeletonLoader className="h-5 w-full" />
          <SkeletonLoader className="h-5 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]/40">
          <CardTitle>{t("dashboard.businessScoreTitle")}</CardTitle>
          <CardDescription>{t("dashboard.businessScoreDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {errorMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!snapshot && summary && summary.items.length > 0) {
    return (
      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]/40">
          <CardTitle>{t("dashboard.businessHealthSummaryTitle")}</CardTitle>
          <CardDescription>{t("dashboard.businessHealthSummaryDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {summary.items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(item.labelKey)}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${summaryStatePill(item.state)}`}>
                  {t(summaryStateLabelKey(item.state))}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t(item.detailsKey)}</p>
            </article>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]/40">
          <CardTitle>{t("dashboard.businessScoreTitle")}</CardTitle>
          <CardDescription>{t("dashboard.businessScoreDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.businessScoreEmpty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.businessScoreTitle")}</CardTitle>
        <CardDescription>{t("dashboard.businessScoreDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-4">
          <div className="relative h-28 w-28" aria-hidden="true">
            <div
              className="absolute inset-0 rounded-full business-score-animate"
              style={{
                background: `conic-gradient(${getScoreColor(normalizedScore)} ${normalizedScore * 3.6}deg, var(--color-surface-muted) 0deg)`,
              }}
            />
            <div className="absolute inset-2 flex items-center justify-center rounded-full bg-[var(--color-surface-card)] text-center shadow-[var(--shadow-small)]">
              <div>
                <p className="text-3xl font-semibold text-[var(--color-text-primary)]"><CountUp value={normalizedScore} durationMs={260} /></p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">AI</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.businessScoreLabel")}</p>
            <p className="text-xl font-semibold" style={{ color: getScoreColor(normalizedScore) }}>
              {t(snapshot.ratingKey)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {snapshot.breakdown.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
              <p className="text-[var(--color-text-secondary)]">{t(item.labelKey)}</p>
              <p className="font-semibold text-[var(--color-text-primary)]"><CountUp value={item.score} durationMs={220} /></p>
              <AnimatedProgress value={item.score} className="col-span-2 h-1.5" durationMs={220} />

              {expanded ? (
                <p className="col-span-2 text-xs text-[var(--color-text-muted)]">{t(item.detailsKey)}</p>
              ) : null}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)]"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? t("dashboard.businessScoreHideDetails") : t("dashboard.businessScoreShowDetails")}
        </button>
      </CardContent>
    </Card>
  );
}

function summaryStateLabelKey(state: "healthy" | "attention" | "restricted" | "unavailable") {
  if (state === "healthy") {
    return "dashboard.businessSummaryStateHealthy";
  }

  if (state === "attention") {
    return "dashboard.businessSummaryStateAttention";
  }

  if (state === "restricted") {
    return "dashboard.businessSummaryStateRestricted";
  }

  return "dashboard.businessSummaryStateUnavailable";
}

function summaryStatePill(state: "healthy" | "attention" | "restricted" | "unavailable") {
  if (state === "healthy") {
    return "bg-[var(--color-success-50)] text-[var(--color-success-700)]";
  }

  if (state === "attention") {
    return "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]";
  }

  if (state === "restricted") {
    return "bg-[var(--color-brand-100)] text-[var(--color-brand-700)]";
  }

  return "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]";
}

function getScoreColor(score: number) {
  if (score >= 90) {
    return "var(--color-success-500)";
  }

  if (score >= 75) {
    return "var(--color-warning-500)";
  }

  return "var(--color-danger-500)";
}
