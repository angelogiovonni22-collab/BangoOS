import { Button, Card, CardContent } from "@/components/ui";

type ProjectTimelineHeaderProps = {
  totalEvents: number;
  dateRangeLabel: string;
  latestActivityLabel: string;
  activeRiskCount: number;
  onSearch: () => void;
  onToggleFilters: () => void;
  onRefresh: () => void;
  onAddNote: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectTimelineHeader({
  totalEvents,
  dateRangeLabel,
  latestActivityLabel,
  activeRiskCount,
  onSearch,
  onToggleFilters,
  onRefresh,
  onAddNote,
  t,
}: ProjectTimelineHeaderProps) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-700)]">{t("projects.tabsIntelligence")}</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">{t("projects.intelligenceTitle")}</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("projects.intelligenceDescription")}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onSearch}>{t("projects.intelligenceSearch")}</Button>
            <Button size="sm" variant="outline" onClick={onToggleFilters}>{t("projects.intelligenceFilters")}</Button>
            <Button size="sm" variant="outline" onClick={onRefresh}>{t("projects.intelligenceRefresh")}</Button>
            <Button size="sm" variant="secondary" disabled title={t("projects.intelligenceExportComingSoon")}>{t("projects.intelligenceExport")}</Button>
            <Button size="sm" onClick={onAddNote}>{t("projects.intelligenceAddManualNote")}</Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={t("projects.intelligenceHeaderTotalEvents")} value={String(totalEvents)} />
          <Metric label={t("projects.intelligenceHeaderDateRange")} value={dateRangeLabel} />
          <Metric label={t("projects.intelligenceHeaderLatestActivity")} value={latestActivityLabel} />
          <Metric label={t("projects.intelligenceHeaderActiveRisks")} value={String(activeRiskCount)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
