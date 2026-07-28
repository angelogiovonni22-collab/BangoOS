import { Badge, Button } from "@/components/ui";
import type { DispatchResource, DispatchStatus } from "@/lib/scheduling";
import { Truck } from "./scheduling-icons";

type DispatchResourceCardProps = {
  item: DispatchResource;
  compact: boolean;
  onStatusChange: (status: DispatchStatus) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function DispatchResourceCard({ item, compact, onStatusChange, t }: DispatchResourceCardProps) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{item.trade} · {item.shift.toUpperCase()}</p>
        </div>
        <Badge tone={item.status === "delayed" ? "danger" : item.status === "on_site" ? "success" : "info"}>{t(`scheduling.dispatchStatus.${item.status}`)}</Badge>
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{item.destination}</p>
      <p className="text-xs text-[var(--color-text-secondary)]">{item.currentAssignmentTitle || t("scheduling.dispatch.unassigned")}</p>

      {!compact ? (
        <>
          <p className="mt-2 text-xs font-medium text-[var(--color-text-secondary)]">
            {t("scheduling.dispatch.utilization")}: {item.utilization}% · {t("scheduling.dispatch.travel")}: {item.estimatedTravelMinutes}m
          </p>
          {item.alerts.length > 0 ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-warning-700)]">
              <Truck className="h-3.5 w-3.5" />
              {item.alerts[0]}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => onStatusChange("in_transit")}>{t("scheduling.dispatch.actions.markInTransit")}</Button>
        <Button size="sm" variant="outline" onClick={() => onStatusChange("on_site")}>{t("scheduling.dispatch.actions.markOnSite")}</Button>
        <Button size="sm" variant="outline" onClick={() => onStatusChange("completed")}>{t("scheduling.dispatch.actions.markCompleted")}</Button>
        <Button size="sm" variant="danger" onClick={() => onStatusChange("off_shift")}>{t("scheduling.dispatch.actions.unassign")}</Button>
      </div>
    </article>
  );
}
