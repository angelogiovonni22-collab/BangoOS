import { Button, Input } from "@/components/ui";
import { calculateLaborTotals, type LaborEntry } from "@/lib/daily-reports";

type LaborSectionProps = {
  value: LaborEntry[];
  onChange: (next: LaborEntry[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function newLaborEntry(): LaborEntry {
  return {
    id: `labor-${Math.random().toString(36).slice(2, 8)}`,
    crewName: "",
    employeeName: "",
    trade: "",
    scheduled: true,
    present: true,
    late: false,
    regularHours: 8,
    overtimeHours: 0,
    notes: "",
  };
}

export function LaborSection({ value, onChange, t }: LaborSectionProps) {
  const totals = calculateLaborTotals(value);

  const update = (id: string, patch: Partial<LaborEntry>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.labor")}</h3>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, newLaborEntry()])}>{t("dailyReports.actions.addWorker")}</Button>
      </div>

      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3 xl:grid-cols-6">
        <Metric label={t("dailyReports.labor.scheduled")} value={String(totals.scheduledWorkers)} />
        <Metric label={t("dailyReports.labor.present")} value={String(totals.presentWorkers)} />
        <Metric label={t("dailyReports.labor.absent")} value={String(totals.absentWorkers)} />
        <Metric label={t("dailyReports.labor.late")} value={String(totals.lateWorkers)} />
        <Metric label={t("dailyReports.labor.overtimeWorkers")} value={String(totals.overtimeWorkers)} />
        <Metric label={t("dailyReports.labor.totalHours")} value={totals.totalLaborHours.toFixed(1)} />
      </div>

      <div className="mt-4 space-y-3">
        {value.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.crew")}</span>
                <Input value={item.crewName} onChange={(event) => update(item.id, { crewName: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.employee")}</span>
                <Input value={item.employeeName} onChange={(event) => update(item.id, { employeeName: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.trade")}</span>
                <Input value={item.trade} onChange={(event) => update(item.id, { trade: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.regularHours")}</span>
                <Input type="number" value={String(item.regularHours)} onChange={(event) => update(item.id, { regularHours: Number(event.target.value) || 0 })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.overtimeHours")}</span>
                <Input type="number" value={String(item.overtimeHours)} onChange={(event) => update(item.id, { overtimeHours: Number(event.target.value) || 0 })} />
              </label>

              <div className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.attendance")}</span>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Toggle label={t("dailyReports.attendance.scheduled")} checked={item.scheduled} onChange={(next) => update(item.id, { scheduled: next })} />
                  <Toggle label={t("dailyReports.attendance.present")} checked={item.present} onChange={(next) => update(item.id, { present: next })} />
                  <Toggle label={t("dailyReports.attendance.late")} checked={item.late} onChange={(next) => update(item.id, { late: next })} />
                </div>
              </div>
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
              <Button variant="danger" size="sm" onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}>
                {t("dailyReports.actions.remove")}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--color-text-primary)]">{value}</p>
    </div>
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
