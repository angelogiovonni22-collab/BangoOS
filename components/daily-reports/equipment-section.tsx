type EquipmentSectionProps = {
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EquipmentSection({ t }: EquipmentSectionProps) {
  return (
    <section className="rounded-[var(--radius-2xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-5">
      <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("dailyReports.sections.equipment")}</h3>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("dailyReports.equipment.placeholder")}</p>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
        <Stub title={t("dailyReports.equipment.fields.used")} />
        <Stub title={t("dailyReports.equipment.fields.operator")} />
        <Stub title={t("dailyReports.equipment.fields.runtime")} />
        <Stub title={t("dailyReports.equipment.fields.idle")} />
        <Stub title={t("dailyReports.equipment.fields.downtime")} />
        <Stub title={t("dailyReports.equipment.fields.maintenance")} />
      </div>
    </section>
  );
}

function Stub({ title }: { title: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">-</p>
    </div>
  );
}
