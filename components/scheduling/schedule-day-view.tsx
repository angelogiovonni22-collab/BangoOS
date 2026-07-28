import type { DragEvent } from "react";
import type { ScheduleAssignment } from "@/lib/scheduling";
import { AssignmentCard } from "./assignment-card";

type ScheduleDayViewProps = {
  date: string;
  items: ScheduleAssignment[];
  onDropAssignment: (assignmentId: string, targetDate: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, assignmentId: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const hours = Array.from({ length: 14 }, (_, idx) => idx + 6);

export function ScheduleDayView({ date, items, onDropAssignment, onDragStart, t }: ScheduleDayViewProps) {
  const byHour = new Map<number, ScheduleAssignment[]>();

  for (const assignment of items) {
    const hour = Number.parseInt(assignment.startTime.slice(0, 2), 10);
    const current = byHour.get(hour) || [];
    current.push(assignment);
    byHour.set(hour, current);
  }

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("scheduling.views.dayTimeline")}</h3>
      <div className="mt-3 space-y-2">
        {hours.map((hour) => {
          const hourItems = byHour.get(hour) || [];

          return (
            <div
              key={hour}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const assignmentId = event.dataTransfer.getData("text/assignment-id");
                if (assignmentId) {
                  onDropAssignment(assignmentId, date);
                }
              }}
              className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-2.5 md:grid-cols-[88px_1fr]"
            >
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{`${String(hour).padStart(2, "0")}:00`}</p>

              <div className="space-y-2">
                {hourItems.length === 0 ? (
                  <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] p-2 text-xs text-[var(--color-text-secondary)]">
                    {t("scheduling.empty.noAssignmentsInSlot")}
                  </p>
                ) : (
                  hourItems.map((assignment) => (
                    <AssignmentCard key={assignment.id} assignment={assignment} draggable onDragStart={onDragStart} t={t} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
