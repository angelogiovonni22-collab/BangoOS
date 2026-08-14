import { Button, Input } from "@/components/ui";
import type { EquipmentUsageItem } from "@/lib/daily-reports";

type EquipmentSectionProps = {
  value: EquipmentUsageItem[];
  onChange: (next: EquipmentUsageItem[]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function newEquipmentUsage(): EquipmentUsageItem {
  return {
    id: `equip-${Math.random().toString(36).slice(2, 8)}`,
    equipmentId: "",
    operatorName: "",
    runtimeHours: 0,
    idleHours: 0,
    downtimeHours: 0,
    maintenanceNotes: "",
  };
}

export function EquipmentSection({ value, onChange, t }: EquipmentSectionProps) {
  const update = (id: string, patch: Partial<EquipmentUsageItem>) => {
    onChange(value.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.equipment")}</h3>
        <Button variant="outline" size="sm" onClick={() => onChange([...(value || []), newEquipmentUsage()])}>{t("dailyReports.actions.addEquipment")}</Button>
      </div>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("dailyReports.equipment.helper")}</p>

      <div className="mt-4 space-y-3">
        {(value || []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{t("dailyReports.common.none")}</p>
        ) : null}

        {(value || []).map((item) => (
          <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-3">
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.equipmentId")}</span>
                <Input value={item.equipmentId} onChange={(event) => update(item.id, { equipmentId: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.operator")}</span>
                <Input value={item.operatorName} onChange={(event) => update(item.id, { operatorName: event.target.value })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.runtime")}</span>
                <Input type="number" value={String(item.runtimeHours)} onChange={(event) => update(item.id, { runtimeHours: Number(event.target.value) || 0 })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.idle")}</span>
                <Input type="number" value={String(item.idleHours)} onChange={(event) => update(item.id, { idleHours: Number(event.target.value) || 0 })} />
              </label>
              <label className="space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
                <span>{t("dailyReports.fields.downtime")}</span>
                <Input type="number" value={String(item.downtimeHours)} onChange={(event) => update(item.id, { downtimeHours: Number(event.target.value) || 0 })} />
              </label>
            </div>

            <label className="mt-2 block space-y-1 text-sm font-medium text-[var(--color-text-secondary)]">
              <span>{t("dailyReports.fields.maintenance")}</span>
              <textarea
                rows={2}
                value={item.maintenanceNotes}
                onChange={(event) => update(item.id, { maintenanceNotes: event.target.value })}
                className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
              />
            </label>

            <div className="mt-2 flex justify-end">
              <Button variant="danger" size="sm" onClick={() => onChange((value || []).filter((entry) => entry.id !== item.id))}>{t("dailyReports.actions.remove")}</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
