import { Button, Input } from "@/components/ui";
import type { WorkCompletedItem } from "@/lib/daily-reports";

type WorkCompletedSectionProps = {
  value: WorkCompletedItem[];
  onChange: (next: WorkCompletedItem[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function newWorkItem(): WorkCompletedItem {
  return {
    id: `work-${Math.random().toString(36).slice(2, 8)}`,
    activity: "",
    quantity: 0,
    unit: "",
    percentComplete: 0,
    productionNotes: "",
    milestoneCompleted: false,
  };
}

export function WorkCompletedSection({ value, onChange, t }: WorkCompletedSectionProps) {
  const update = (id: string, patch: Partial<WorkCompletedItem>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.workCompleted")}</h3>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, newWorkItem()])}>{t("dailyReports.actions.addWorkItem")}</Button>
      </div>

      <div className="mt-4 space-y-3">
        {value.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)] xl:col-span-2">
                <span>{t("dailyReports.fields.activity")}</span>
                <Input value={item.activity} onChange={(event) => update(item.id, { activity: event.target.value })} />
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
                <span>{t("dailyReports.fields.percentComplete")}</span>
                <Input type="number" value={String(item.percentComplete)} onChange={(event) => update(item.id, { percentComplete: Number(event.target.value) || 0 })} />
              </label>
            </div>

            <label className="mt-2 block space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.productionNotes")}</span>
              <textarea
                rows={2}
                value={item.productionNotes}
                onChange={(event) => update(item.id, { productionNotes: event.target.value })}
                className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
              />
            </label>

            <label className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <input type="checkbox" checked={item.milestoneCompleted} onChange={(event) => update(item.id, { milestoneCompleted: event.target.checked })} />
              {t("dailyReports.fields.milestoneCompleted")}
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
