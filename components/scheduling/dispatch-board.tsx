import { Select } from "@/components/ui";
import { useDispatch } from "@/lib/scheduling";
import type { DispatchResource, DispatchStatus } from "@/lib/scheduling";
import { DispatchColumn } from "./dispatch-column";

type DispatchBoardProps = {
  resources: DispatchResource[];
  projectOptions: Array<{ id: string; name: string }>;
  tradeOptions: string[];
  onMove: (dispatchId: string, status: DispatchStatus) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const statuses: DispatchStatus[] = ["available", "assigned", "in_transit", "on_site", "delayed", "completed", "off_shift"];

export function DispatchBoard({ resources, projectOptions, tradeOptions, onMove, t }: DispatchBoardProps) {
  const {
    filtered,
    project,
    setProject,
    trade,
    setTrade,
    shift,
    setShift,
    status,
    setStatus,
    compact,
    setCompact,
  } = useDispatch(resources);

  return (
    <section className="space-y-3 rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("scheduling.dispatch.title")}</h3>
        <button
          type="button"
          onClick={() => setCompact((current) => !current)}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)]"
        >
          {compact ? t("scheduling.dispatch.detailedMode") : t("scheduling.dispatch.compactMode")}
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <Select value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="all">{t("scheduling.filters.allProjects")}</option>
          {projectOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </Select>
        <Select value={trade} onChange={(event) => setTrade(event.target.value)}>
          <option value="all">{t("scheduling.filters.allTrades")}</option>
          {tradeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </Select>
        <Select value={shift} onChange={(event) => setShift(event.target.value as "all" | "day" | "swing" | "night")}>
          <option value="all">{t("scheduling.filters.allShifts")}</option>
          <option value="day">{t("scheduling.shift.day")}</option>
          <option value="swing">{t("scheduling.shift.swing")}</option>
          <option value="night">{t("scheduling.shift.night")}</option>
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value as "all" | DispatchStatus)}>
          <option value="all">{t("scheduling.filters.allStatuses")}</option>
          {statuses.map((item) => (
            <option key={item} value={item}>{t(`scheduling.dispatchStatus.${item}`)}</option>
          ))}
        </Select>
      </div>

      <div className="grid gap-3 overflow-x-auto pb-1 md:grid-cols-2 2xl:grid-cols-4">
        {statuses.map((item) => (
          <DispatchColumn
            key={item}
            status={item}
            title={t(`scheduling.dispatchStatus.${item}`)}
            items={filtered.filter((resource) => resource.status === item)}
            compact={compact}
            onDropResource={onMove}
            onStatusChange={onMove}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}
