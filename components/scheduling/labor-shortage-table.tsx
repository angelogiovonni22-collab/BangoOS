import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { LaborDemand } from "@/lib/scheduling";

type LaborShortageTableProps = {
  title: string;
  data: LaborDemand[];
  mode: "shortage" | "surplus";
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function LaborShortageTable({ title, data, mode, t }: LaborShortageTableProps) {
  const filtered = data.filter((item) => mode === "shortage" ? item.laborShortage > 0 : item.laborSurplus > 0);

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t("scheduling.empty.noForecastData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                  <th className="px-2 py-2">{t("scheduling.forecast.columns.bucket")}</th>
                  <th className="px-2 py-2">{t("scheduling.forecast.columns.required")}</th>
                  <th className="px-2 py-2">{t("scheduling.forecast.columns.scheduled")}</th>
                  <th className="px-2 py-2">{mode === "shortage" ? t("scheduling.forecast.columns.shortage") : t("scheduling.forecast.columns.surplus")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 8).map((item) => (
                  <tr key={item.key} className="border-t border-[var(--color-border-subtle)]">
                    <td className="px-2 py-2 font-semibold text-[var(--color-text-primary)]">{item.label}</td>
                    <td className="px-2 py-2">{item.requiredHeadcount}</td>
                    <td className="px-2 py-2">{item.scheduledHeadcount}</td>
                    <td className="px-2 py-2 font-semibold">{mode === "shortage" ? item.laborShortage : item.laborSurplus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
