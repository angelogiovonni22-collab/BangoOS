import type { DragEvent, KeyboardEvent } from "react";
import { Badge } from "@/components/ui";
import type { ScheduleAssignment } from "@/lib/scheduling";
import { GripVertical, TriangleAlert } from "./scheduling-icons";

type AssignmentCardProps = {
  assignment: ScheduleAssignment;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>, assignmentId: string) => void;
  onSelect?: (assignment: ScheduleAssignment) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function AssignmentCard({ assignment, draggable, onDragStart, onSelect, t }: AssignmentCardProps) {
  const interactive = Boolean(onSelect);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(assignment);
    }
  };

  return (
    <article
      draggable={draggable}
      onDragStart={(event) => onDragStart?.(event, assignment.id)}
      onClick={() => onSelect?.(assignment)}
      onKeyDown={handleKeyDown}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `${assignment.title} · ${assignment.startTime} - ${assignment.endTime}` : undefined}
      className={`rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-2.5 shadow-[var(--shadow-small)] ${interactive ? "cursor-pointer transition hover:border-[var(--color-brand-400)] hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">{assignment.title}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {assignment.startTime} - {assignment.endTime} · {assignment.requiredTrade}
          </p>
        </div>

        {draggable ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]" aria-hidden="true">
            <GripVertical className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={assignment.status === "published" ? "info" : assignment.status === "completed" ? "success" : assignment.status === "cancelled" ? "danger" : "neutral"}>
          {t(`scheduling.assignmentStatus.${assignment.status}`)}
        </Badge>
        <Badge tone={assignment.priority === "critical" ? "danger" : assignment.priority === "high" ? "warning" : "neutral"}>
          {t(`scheduling.priority.${assignment.priority}`)}
        </Badge>
      </div>

      {assignment.isOpenShift ? (
        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-warning-700)]">
          <TriangleAlert className="h-3.5 w-3.5" />
          {t("scheduling.assignment.openShift")}
        </p>
      ) : null}
    </article>
  );
}
