import { Button, Input, Select } from "@/components/ui";
import type { SafetyItem } from "@/lib/daily-reports";

type SafetySectionProps = {
  value: SafetyItem[];
  onChange: (next: SafetyItem[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function newSafetyItem(): SafetyItem {
  return {
    id: `safe-${Math.random().toString(36).slice(2, 8)}`,
    type: "toolbox_talk",
    attendees: 0,
    severity: "low",
    status: "open",
    notes: "",
  };
}

export function SafetySection({ value, onChange, t }: SafetySectionProps) {
  const update = (id: string, patch: Partial<SafetyItem>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.safety")}</h3>
        <Button variant="outline" size="sm" onClick={() => onChange([...value, newSafetyItem()])}>{t("dailyReports.actions.addSafetyItem")}</Button>
      </div>

      <div className="mt-4 space-y-3">
        {value.map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.safetyType")}</span>
                <Select value={item.type} onChange={(event) => update(item.id, { type: event.target.value as SafetyItem["type"] })}>
                  <option value="toolbox_talk">{t("dailyReports.safetyType.toolbox_talk")}</option>
                  <option value="inspection">{t("dailyReports.safetyType.inspection")}</option>
                  <option value="incident">{t("dailyReports.safetyType.incident")}</option>
                  <option value="near_miss">{t("dailyReports.safetyType.near_miss")}</option>
                  <option value="ppe">{t("dailyReports.safetyType.ppe")}</option>
                  <option value="corrective_action">{t("dailyReports.safetyType.corrective_action")}</option>
                </Select>
              </label>

              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.attendees")}</span>
                <Input type="number" value={String(item.attendees)} onChange={(event) => update(item.id, { attendees: Number(event.target.value) || 0 })} />
              </label>

              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.severity")}</span>
                <Select value={item.severity} onChange={(event) => update(item.id, { severity: event.target.value as SafetyItem["severity"] })}>
                  <option value="low">{t("dailyReports.severity.low")}</option>
                  <option value="medium">{t("dailyReports.severity.medium")}</option>
                  <option value="high">{t("dailyReports.severity.high")}</option>
                  <option value="critical">{t("dailyReports.severity.critical")}</option>
                </Select>
              </label>

              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.status")}</span>
                <Select value={item.status} onChange={(event) => update(item.id, { status: event.target.value as SafetyItem["status"] })}>
                  <option value="open">{t("dailyReports.safetyStatus.open")}</option>
                  <option value="monitoring">{t("dailyReports.safetyStatus.monitoring")}</option>
                  <option value="resolved">{t("dailyReports.safetyStatus.resolved")}</option>
                </Select>
              </label>

              <div className="flex items-end justify-end">
                <Button variant="danger" size="sm" onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}>
                  {t("dailyReports.actions.remove")}
                </Button>
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
          </article>
        ))}
      </div>
    </section>
  );
}
