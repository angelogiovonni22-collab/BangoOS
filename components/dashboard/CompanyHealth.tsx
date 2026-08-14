import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { AIBusinessScoreSnapshot } from "@/lib/dashboard/types";

type CompanyHealthProps = {
  snapshot: AIBusinessScoreSnapshot;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CompanyHealth({ snapshot, t }: CompanyHealthProps) {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(snapshot.score)));
  const ringColor = normalizedScore >= 85
    ? "var(--color-success-500)"
    : normalizedScore >= 70
      ? "var(--color-warning-500)"
      : "var(--color-danger-500)";

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.companyHealth")}</CardTitle>
        <CardDescription>{t("dashboard.companyHealthDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <div
            className="relative h-24 w-24 rounded-full"
            style={{
              background: `conic-gradient(${ringColor} ${normalizedScore * 3.6}deg, var(--color-surface-muted) 0deg)`,
            }}
            aria-hidden="true"
          >
            <div className="absolute inset-2 flex items-center justify-center rounded-full bg-[var(--color-surface-card)] text-xl font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-small)]">
              {normalizedScore}
            </div>
          </div>

          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.companyHealthScore")}</p>
            <p className="text-2xl font-semibold text-[var(--color-text-primary)]">{normalizedScore}/100</p>
          </div>
        </div>

        <div className="space-y-3">
          {snapshot.breakdown.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">{t(item.labelKey)}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.score}</p>
              <div className="col-span-2 h-2 rounded-full bg-[var(--color-surface-muted)]">
                <div
                  className="h-2 rounded-full bg-[var(--color-brand-600)]"
                  style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
