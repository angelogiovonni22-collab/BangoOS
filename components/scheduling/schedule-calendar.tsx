"use client";

import { useMemo, useState, type DragEvent } from "react";
import { Button } from "@/components/ui";
import type { ScheduleAssignment, ScheduleGroup, ScheduleView } from "@/lib/scheduling";
import { ScheduleDayView } from "./schedule-day-view";
import { ScheduleMonthView } from "./schedule-month-view";
import { ScheduleWeekView } from "./schedule-week-view";

type ScheduleCalendarProps = {
  view: ScheduleView;
  groupBy: ScheduleGroup;
  date: string;
  assignments: ScheduleAssignment[];
  crewOptions?: Array<{ id: string; name: string }>;
  employeeOptions?: Array<{ id: string; name: string }>;
  onMoveAssignment: (assignmentId: string, targetDate: string) => void;
  onQuickMoveShift: (assignmentId: string, shift: "day" | "swing" | "night") => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ScheduleCalendar({
  view,
  groupBy,
  date,
  assignments,
  crewOptions = [],
  employeeOptions = [],
  onMoveAssignment,
  onQuickMoveShift,
  t,
}: ScheduleCalendarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const visible = useMemo(() => [...assignments].sort((a, b) => a.startTime.localeCompare(b.startTime)), [assignments]);

  const moveToShift = (assignmentId: string, shift: "day" | "swing" | "night") => {
    onQuickMoveShift(assignmentId, shift);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t("scheduling.calendar.title")}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => draggingId && moveToShift(draggingId, "day")}>{t("scheduling.shift.day")}</Button>
          <Button variant="outline" size="sm" onClick={() => draggingId && moveToShift(draggingId, "swing")}>{t("scheduling.shift.swing")}</Button>
          <Button variant="outline" size="sm" onClick={() => draggingId && moveToShift(draggingId, "night")}>{t("scheduling.shift.night")}</Button>
        </div>
      </div>

      {view === "day" ? (
        <ScheduleDayView
          date={date}
          items={visible.filter((item) => item.date === date)}
          onDropAssignment={(assignmentId, targetDate) => {
            setDraggingId(null);
            onMoveAssignment(assignmentId, targetDate);
          }}
          onDragStart={(event: DragEvent<HTMLElement>, assignmentId) => {
            event.dataTransfer.setData("text/assignment-id", assignmentId);
            setDraggingId(assignmentId);
          }}
          t={t}
        />
      ) : null}

      {view === "week" ? (
        <ScheduleWeekView
          baseDate={date}
          assignments={visible}
          groupBy={groupBy}
          crewOptions={crewOptions}
          employeeOptions={employeeOptions}
          onDropAssignment={(assignmentId, targetDate) => {
            setDraggingId(null);
            onMoveAssignment(assignmentId, targetDate);
          }}
          onDragStart={(event: DragEvent<HTMLElement>, assignmentId) => {
            event.dataTransfer.setData("text/assignment-id", assignmentId);
            setDraggingId(assignmentId);
          }}
          t={t}
        />
      ) : null}

      {view === "month" ? (
        <ScheduleMonthView baseDate={date} assignments={visible} t={t} />
      ) : null}
    </section>
  );
}
