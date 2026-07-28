import { Badge, Button } from "@/components/ui";
import type { ScheduleConflict } from "@/lib/scheduling";

type ConflictCardProps = {
  conflict: ScheduleConflict;
  onResolve: (status: "acknowledged" | "dismissed" | "resolved") => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ConflictCard({ conflict, onResolve, t }: ConflictCardProps) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{conflict.title}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{conflict.explanation}</p>
        </div>
        <Badge tone={tone(conflict.severity)}>{t(`scheduling.severity.${conflict.severity}`)}</Badge>
      </div>

      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{conflict.recommendedAction}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => onResolve("acknowledged")}>{t("scheduling.conflicts.actions.acknowledge")}</Button>
        <Button size="sm" variant="outline" onClick={() => onResolve("dismissed")}>{t("scheduling.conflicts.actions.dismiss")}</Button>
        <Button size="sm" onClick={() => onResolve("resolved")}>{t("scheduling.conflicts.actions.resolve")}</Button>
      </div>
    </article>
  );
}

function tone(severity: ScheduleConflict["severity"]): "danger" | "warning" | "info" | "neutral" {
  if (severity === "critical") {
    return "danger";
  }

  if (severity === "high") {
    return "warning";
  }

  if (severity === "medium") {
    return "info";
  }

  return "neutral";
}
