import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, SkeletonLoader } from "@/components/ui";
import type { AIBusinessScoreSnapshot } from "@/lib/dashboard/types";

type BusinessScoreProps = {
  snapshot: AIBusinessScoreSnapshot | null;
  isLoading?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function BusinessScore({ snapshot, isLoading = false, t }: BusinessScoreProps) {
  const [expanded, setExpanded] = useState(false);

  const normalizedScore = useMemo(() => {
    if (!snapshot) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(snapshot.score)));
  }, [snapshot]);

  if (isLoading) {
    return (
      <Card as="section">
        <CardHeader>
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

  if (!snapshot) {
    return (
      <Card as="section">
        <CardHeader>
          <CardTitle>{t("dashboard.businessScoreTitle")}</CardTitle>
          <CardDescription>{t("dashboard.businessScoreDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.businessScoreEmpty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card as="section">
      <CardHeader>
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
            <div className="absolute inset-2 flex items-center justify-center rounded-full bg-white text-center shadow-[var(--shadow-small)]">
              <div>
                <p className="text-3xl font-semibold text-[var(--color-text-primary)]">{normalizedScore}</p>
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
              <p className="font-semibold text-[var(--color-text-primary)]">{item.score}</p>

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

function getScoreColor(score: number) {
  if (score >= 90) {
    return "var(--color-success-500)";
  }

  if (score >= 75) {
    return "var(--color-warning-500)";
  }

  return "var(--color-danger-500)";
}
