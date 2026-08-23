import type { DragEvent } from "react";
import type { ScheduleAssignment, ScheduleGroup } from "@/lib/scheduling";
import { AssignmentCard } from "./assignment-card";

type ScheduleWeekViewProps = {
  baseDate: string;
  assignments: ScheduleAssignment[];
  groupBy: ScheduleGroup;
  locale: "en" | "es";
  onDropAssignment: (assignmentId: string, targetDate: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, assignmentId: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

function getWeekDays(baseDate: string) {
  const base = new Date(`${baseDate}T00:00:00Z`);
  const day = base.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(monday);
    value.setUTCDate(monday.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });
}

function groupLabel(assignment: ScheduleAssignment, groupBy: ScheduleGroup) {
  if (groupBy === "project") {
    return assignment.scope.projectName;
  }

  if (groupBy === "crew") {
    return assignment.assignedCrewIds.join(", ") || "Unassigned Crew";
  }

  if (groupBy === "employee") {
    return assignment.assignedEmployeeIds.join(", ") || "Unassigned Employee";
  }

  if (groupBy === "trade") {
    return assignment.requiredTrade;
  }

  return assignment.scope.location;
}

export function ScheduleWeekView({
  baseDate,
  assignments,
  groupBy,
  locale,
  onDropAssignment,
  onDragStart,
  t,
}: ScheduleWeekViewProps) {
  const days = getWeekDays(baseDate);
  const grouped = new Map<string, ScheduleAssignment[]>();

  for (const assignment of assignments) {
    const key = groupLabel(assignment, groupBy);
    const current = grouped.get(key) || [];
    current.push(assignment);
    grouped.set(key, current);
  }

  return (
    <section className="overflow-x-auto rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-card)]">
      <table className="min-w-[980px] w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--color-surface-card)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
              {t(`scheduling.group.${groupBy}`)}
            </th>
            {days.map((day) => (
              <th key={day} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                {new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(grouped.entries()).map(([label, groupAssignments]) => (
            <tr key={label}>
              <th className="sticky left-0 z-10 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-3 text-left text-sm font-semibold text-[var(--color-text-primary)]">
                {label}
              </th>
              {days.map((day) => {
                const dayItems = groupAssignments.filter((item) => item.date === day);
                return (
                  <td
                    key={`${label}-${day}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const assignmentId = event.dataTransfer.getData("text/assignment-id");
                      if (assignmentId) {
                        onDropAssignment(assignmentId, day);
                      }
                    }}
                    className="min-w-[210px] border-t border-l border-[var(--color-border-subtle)] align-top"
                  >
                    <div className="space-y-2 p-2">
                      {dayItems.length === 0 ? (
                        <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] p-2 text-xs text-[var(--color-text-secondary)]">
                          {t("scheduling.empty.noAssignmentsInSlot")}
                        </div>
                      ) : (
                        dayItems.map((assignment) => (
                          <AssignmentCard key={assignment.id} assignment={assignment} draggable onDragStart={onDragStart} t={t} />
                        ))
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
