import { Button, Input, Select } from "@/components/ui";
import type { DelayItem } from "@/lib/daily-reports";

type DelaysSectionProps = {
  value: DelayItem[];
  onChange: (next: DelayItem[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function newDelayItem(): DelayItem {
  return {
    id: `delay-${Math.random().toString(36).slice(2, 8)}`,
    category: "weather",
    durationHours: 0,
    description: "",
    impact: "",
    correctiveAction: "",
  };
}

export function DelaysSection({ value, onChange, t }: DelaysSectionProps) {
  const update = (id: string, patch: Partial<DelayItem>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.delays")}</h3>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, newDelayItem()])}>{t("dailyReports.actions.addDelay")}</Button>
      </div>

      <div className="mt-4 space-y-3">
        {value.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.delayCategory")}</span>
                <Select value={item.category} onChange={(event) => update(item.id, { category: event.target.value as DelayItem["category"] })}>
                  <option value="weather">{t("dailyReports.delayCategory.weather")}</option>
                  <option value="material">{t("dailyReports.delayCategory.material")}</option>
                  <option value="equipment">{t("dailyReports.delayCategory.equipment")}</option>
                  <option value="client">{t("dailyReports.delayCategory.client")}</option>
                  <option value="utility">{t("dailyReports.delayCategory.utility")}</option>
                  <option value="inspection">{t("dailyReports.delayCategory.inspection")}</option>
                  <option value="safety">{t("dailyReports.delayCategory.safety")}</option>
                  <option value="other">{t("dailyReports.delayCategory.other")}</option>
                </Select>
              </label>

              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.durationHours")}</span>
                <Input type="number" value={String(item.durationHours)} onChange={(event) => update(item.id, { durationHours: Number(event.target.value) || 0 })} />
              </label>

              <div className="flex items-end justify-end">
                <Button variant="danger" size="sm" onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}>{t("dailyReports.actions.remove")}</Button>
              </div>
            </div>

            <label className="mt-2 block space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.description")}</span>
              <textarea
                rows={2}
                value={item.description}
                onChange={(event) => update(item.id, { description: event.target.value })}
                className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
              />
            </label>

            <label className="mt-2 block space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.impact")}</span>
              <textarea
                rows={2}
                value={item.impact}
                onChange={(event) => update(item.id, { impact: event.target.value })}
                className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
              />
            </label>

            <label className="mt-2 block space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.correctiveAction")}</span>
              <textarea
                rows={2}
                value={item.correctiveAction}
                onChange={(event) => update(item.id, { correctiveAction: event.target.value })}
                className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
              />
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
