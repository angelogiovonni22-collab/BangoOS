import { Button, Input, Select } from "@/components/ui";
import { PRICING_PROVIDERS, type MaterialItem } from "@/lib/daily-reports";

type MaterialsSectionProps = {
  value: MaterialItem[];
  onChange: (next: MaterialItem[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function newMaterial(): MaterialItem {
  return {
    id: `mat-${Math.random().toString(36).slice(2, 8)}`,
    delivery: "",
    supplier: "",
    quantity: 0,
    unit: "",
    receivedTime: "",
    shortages: false,
    rejected: false,
    notes: "",
  };
}

export function MaterialsSection({ value, onChange, t }: MaterialsSectionProps) {
  const update = (id: string, patch: Partial<MaterialItem>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const isKnownPricingProvider = (supplier: string) => PRICING_PROVIDERS.includes(supplier as (typeof PRICING_PROVIDERS)[number]);

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.materials")}</h3>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, newMaterial()])}>{t("dailyReports.actions.addMaterial")}</Button>
      </div>

      <div className="mt-4 space-y-3">
        {value.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)] xl:col-span-2">
                <span>{t("dailyReports.fields.delivery")}</span>
                <Input value={item.delivery} onChange={(event) => update(item.id, { delivery: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.supplier")}</span>
                <Select value={item.supplier} onChange={(event) => update(item.id, { supplier: event.target.value })}>
                  <option value="">{t("common.none")}</option>
                  {item.supplier && !isKnownPricingProvider(item.supplier) ? <option value={item.supplier}>{item.supplier}</option> : null}
                  {PRICING_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </Select>
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.quantity")}</span>
                <Input type="number" value={String(item.quantity)} onChange={(event) => update(item.id, { quantity: Number(event.target.value) || 0 })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.unit")}</span>
                <Input value={item.unit} onChange={(event) => update(item.id, { unit: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.receivedTime")}</span>
                <Input type="time" value={item.receivedTime} onChange={(event) => update(item.id, { receivedTime: event.target.value })} />
              </label>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <Toggle label={t("dailyReports.fields.shortages")} checked={item.shortages} onChange={(next) => update(item.id, { shortages: next })} />
              <Toggle label={t("dailyReports.fields.rejectedMaterial")} checked={item.rejected} onChange={(next) => update(item.id, { rejected: next })} />
            </div>

            <label className="mt-2 block space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.notes")}</span>
              <textarea
                rows={2}
                value={item.notes}
                onChange={(event) => update(item.id, { notes: event.target.value })}
                className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
              />
            </label>

            <div className="mt-2 flex justify-end">
              <Button variant="danger" size="sm" onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}>{t("dailyReports.actions.remove")}</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
