import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { LaborDemand } from "@/lib/scheduling";

type LaborDemandChartProps = {
  title: string;
  data: LaborDemand[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function LaborDemandChart({ title, data, t }: LaborDemandChartProps) {
  const max = Math.max(1, ...data.map((item) => item.requiredHeadcount));

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.slice(0, 8).map((item) => (
          <div key={item.key}>
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>{item.label}</span>
              <span>{item.scheduledHeadcount}/{item.requiredHeadcount}</span>
            </div>
            <div className="mt-1 h-2 rounded bg-[var(--color-surface-subtle)]">
              <div className="h-2 rounded bg-[var(--color-brand-600)]" style={{ width: `${Math.max(8, Math.round((item.scheduledHeadcount / max) * 100))}%` }} />
            </div>
            {item.laborShortage > 0 ? (
              <p className="mt-1 text-[11px] font-medium text-[var(--color-warning-700)]">
                {t("scheduling.forecast.shortage", { count: item.laborShortage })}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
