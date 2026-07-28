import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { LaborForecast, LaborForecastRange } from "@/lib/scheduling";

type LaborForecastSummaryProps = {
  forecast: LaborForecast;
  range: LaborForecastRange;
  onRangeChange: (value: LaborForecastRange) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const ranges: LaborForecastRange[] = ["tomorrow", "7d", "14d", "30d"];

export function LaborForecastSummary({ forecast, range, onRangeChange, t }: LaborForecastSummaryProps) {
  return (
    <Card as="section">
      <CardHeader className="space-y-3">
        <CardTitle>{t("scheduling.forecast.title")}</CardTitle>
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <Button key={item} size="sm" variant={range === item ? "primary" : "outline"} onClick={() => onRangeChange(item)}>
              {t(`scheduling.forecast.range.${item}`)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {forecast.summaryCards.map((card) => (
          <article key={card.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t(card.label)}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">{card.value}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t(card.trend)}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
