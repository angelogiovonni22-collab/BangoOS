import type { DragEvent } from "react";
import type { ScheduleAssignment, ScheduleGroup } from "@/lib/scheduling";
import { AssignmentCard } from "./assignment-card";

type ScheduleWeekViewProps = {
  baseDate: string;
  assignments: ScheduleAssignment[];
  groupBy: ScheduleGroup;
  crewOptions?: Array<{ id: string; name: string }>;
  employeeOptions?: Array<{ id: string; name: string }>;
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

function groupLabel(
  assignment: ScheduleAssignment,
  groupBy: ScheduleGroup,
  crewNames: Map<string, string>,
  employeeNames: Map<string, string>,
) {
  if (groupBy === "project") {
    return assignment.scope.projectName;
  }

  if (groupBy === "crew") {
    return assignment.assignedCrewIds.map((id) => crewNames.get(id) || "Assigned Crew").join(", ") || "Unassigned Crew";
  }

  if (groupBy === "employee") {
    return assignment.assignedEmployeeIds.map((id) => employeeNames.get(id) || "Assigned Employee").join(", ") || "Unassigned Employee";
  }

  if (groupBy === "trade") {
    return assignment.requiredTrade || "Unspecified Trade";
  }

  return assignment.scope.location || "Unspecified Location";
}

export function ScheduleWeekView({
  baseDate,
  assignments,
  groupBy,
  crewOptions = [],
  employeeOptions = [],
  onDropAssignment,
  onDragStart,
  t,
}: ScheduleWeekViewProps) {
  const days = getWeekDays(baseDate);
  const grouped = new Map<string, ScheduleAssignment[]>();
  const crewNames = new Map(crewOptions.map((item) => [item.id, item.name]));
  const employeeNames = new Map(employeeOptions.map((item) => [item.id, item.name]));

  for (const assignment of assignments) {
    const key = groupLabel(assignment, groupBy, crewNames, employeeNames);
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
                {new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${day}T00:00:00Z`))}
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
