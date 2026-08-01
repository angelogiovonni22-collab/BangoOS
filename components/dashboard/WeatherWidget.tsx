import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { WeatherSnapshot } from "@/lib/dashboard/types";

type WeatherWidgetProps = {
  weather: WeatherSnapshot | null;
  errorMessage?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function WeatherWidget({ weather, errorMessage = null, t }: WeatherWidgetProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.weather")}</CardTitle>
        <CardDescription>{t("dashboard.weatherDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="p-5">
        {errorMessage ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {errorMessage}
          </p>
        ) : null}

        {!errorMessage && !weather ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.weatherUnavailable")}
          </p>
        ) : null}

        {weather ? (
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{weather.location}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">{weather.temperatureF}°F</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t(weather.conditionKey)}</p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            {t("dashboard.weatherHighLow", { high: weather.highF, low: weather.lowF })}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)]">
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
              {t("dashboard.weatherWind", { speed: weather.windMph })}
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
              {t("dashboard.weatherRainChance", { chance: weather.rainProbabilityPercent })}
            </div>
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-xs text-[var(--color-text-secondary)]">
            <p className="font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("dashboard.weatherTomorrow")}</p>
            <p className="mt-1">{t(weather.tomorrow.conditionKey)}</p>
            <p className="mt-1">{t("dashboard.weatherHighLow", { high: weather.tomorrow.highF, low: weather.tomorrow.lowF })}</p>
            <p className="mt-1">{t("dashboard.weatherRainChance", { chance: weather.tomorrow.rainProbabilityPercent })}</p>
          </div>
        </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
