"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Button, Input, Select } from "@/components/ui";
import { createSchedulingService, type AssignmentDraft, type ScheduleAssignment, type ScheduleGroup, type SchedulingPayload } from "@/lib/scheduling";
import { AssignmentCard } from "./assignment-card";

type ScheduleWeekViewProps = {
  baseDate: string;
  assignments: ScheduleAssignment[];
  groupBy: ScheduleGroup;
  locale: "en" | "es";
  onDropAssignment: (assignmentId: string, targetDate: string) => void;
  onDragStart: (event: DragEvent<HTMLElement>, assignmentId: string) => void;
  onSelectAssignment: (assignment: ScheduleAssignment) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type QuickSlot = {
  groupKey: string;
  day: string;
};

type QuickForm = {
  title: string;
  projectId: string;
  requiredTrade: string;
  startTime: string;
  endTime: string;
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

function groupKey(assignment: ScheduleAssignment, groupBy: ScheduleGroup) {
  if (groupBy === "project") return assignment.scope.projectId || assignment.scope.projectName;
  if (groupBy === "crew") return assignment.assignedCrewIds.join("|") || "unassigned-crew";
  if (groupBy === "employee") return assignment.assignedEmployeeIds.join("|") || "unassigned-employee";
  if (groupBy === "trade") return assignment.requiredTrade || "Unassigned Trade";
  return assignment.scope.location || "Unassigned Location";
}

function readableGroupLabel(
  key: string,
  groupAssignments: ScheduleAssignment[],
  groupBy: ScheduleGroup,
  metadata: SchedulingPayload | null,
) {
  const first = groupAssignments[0];
  if (!first) return "Unassigned";
  if (groupBy === "project") return first.scope.projectName || "Unassigned Project";
  if (groupBy === "trade") return first.requiredTrade || "Unassigned Trade";
  if (groupBy === "location") return first.scope.location || "Unassigned Location";

  if (groupBy === "crew") {
    if (key === "unassigned-crew") return "Unassigned Crew";
    const names = first.assignedCrewIds
      .map((id) => metadata?.crewOptions.find((crew) => crew.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(", ") : "Crew";
  }

  if (key === "unassigned-employee") return "Unassigned Employee";
  const names = first.assignedEmployeeIds
    .map((id) => metadata?.employeeOptions.find((employee) => employee.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : "Employee";
}

function newQuickForm(metadata: SchedulingPayload | null): QuickForm {
  return {
    title: "",
    projectId: metadata?.projectOptions[0]?.id || "",
    requiredTrade: metadata?.tradeOptions[0] || "General Labor",
    startTime: "07:00",
    endTime: "15:30",
  };
}

export function ScheduleWeekView({
  baseDate,
  assignments,
  groupBy,
  locale,
  onDropAssignment,
  onDragStart,
  onSelectAssignment,
  t,
}: ScheduleWeekViewProps) {
  const days = getWeekDays(baseDate);
  const schedulingService = useMemo(() => createSchedulingService(), []);
  const [metadata, setMetadata] = useState<SchedulingPayload | null>(null);
  const [optimisticAssignments, setOptimisticAssignments] = useState<ScheduleAssignment[] | null>(null);
  const [quickSlot, setQuickSlot] = useState<QuickSlot | null>(null);
  const [quickForm, setQuickForm] = useState<QuickForm>(() => newQuickForm(null));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const liveAssignments = optimisticAssignments ?? assignments;

  useEffect(() => {
    let active = true;
    void schedulingService.getScheduling().then((payload) => {
      if (!active) return;
      setMetadata(payload);
      setQuickForm((current) => ({
        ...current,
        projectId: current.projectId || payload.projectOptions[0]?.id || "",
        requiredTrade: current.requiredTrade || payload.tradeOptions[0] || "General Labor",
      }));
    }).catch(() => {
      // The calendar still renders safely if metadata lookup is temporarily unavailable.
    });
    return () => {
      active = false;
    };
  }, [schedulingService]);

  const grouped = new Map<string, ScheduleAssignment[]>();
  for (const assignment of liveAssignments) {
    const key = groupKey(assignment, groupBy);
    const current = grouped.get(key) || [];
    current.push(assignment);
    grouped.set(key, current);
  }

  const openQuickAdd = (key: string, day: string) => {
    if (groupBy !== "crew" || key === "unassigned-crew") return;
    setSaveError(null);
    setQuickSlot({ groupKey: key, day });
    setQuickForm(newQuickForm(metadata));
  };

  const saveQuickAssignment = async (groupAssignments: ScheduleAssignment[]) => {
    if (!quickSlot || !metadata || !quickForm.title.trim() || !quickForm.projectId) {
      setSaveError("Add an assignment name and project before saving.");
      return;
    }

    const assignedCrewIds = groupAssignments[0]?.assignedCrewIds || [];
    if (assignedCrewIds.length === 0) {
      setSaveError("This crew could not be resolved. Open the full Schedule workspace to create the assignment.");
      return;
    }

    const project = metadata.projectOptions.find((item) => item.id === quickForm.projectId);
    const draft: AssignmentDraft = {
      title: quickForm.title.trim(),
      type: "project_work",
      projectId: quickForm.projectId,
      location: project?.name || "",
      date: quickSlot.day,
      startTime: quickForm.startTime,
      endTime: quickForm.endTime,
      shift: "day",
      assignedCrewIds,
      assignedEmployeeIds: [],
      requiredTrade: quickForm.requiredTrade || "General Labor",
      requiredHeadcount: 1,
      supervisor: "",
      priority: "medium",
      status: "published",
      notes: "",
      travelTimeMinutes: 30,
      recurrence: { enabled: false, frequency: "weekly", interval: 1, endDate: null },
      equipment: { requiredEquipment: [], assignedEquipment: [], operatorRequired: false },
      safetyRequirement: "",
      certificationRequirement: "",
    };

    setIsSaving(true);
    setSaveError(null);
    try {
      const next = await schedulingService.createAssignment(draft);
      setMetadata(next);
      setOptimisticAssignments(next.assignments);
      setQuickSlot(null);
    } catch {
      setSaveError("Unable to save the assignment. Try again or use the full Schedule workspace.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="overflow-x-auto rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 shadow-[var(--shadow-card)] sm:p-4">
      <table className="w-full min-w-[980px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[150px] bg-[var(--color-surface-card)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
              {groupBy === "crew" ? "Crew" : t(`scheduling.group.${groupBy}`)}
            </th>
            {days.map((day) => (
              <th key={day} className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
                {new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(grouped.entries()).map(([key, groupAssignments]) => {
            const label = readableGroupLabel(key, groupAssignments, groupBy, metadata);
            return (
              <tr key={key} className="bg-transparent">
                <th className="sticky left-0 z-10 max-w-[220px] border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-3 text-left text-sm font-semibold text-[var(--color-text-primary)]">
                  <span className="block truncate" title={label}>{label}</span>
                </th>
                {days.map((day) => {
                  const dayItems = groupAssignments.filter((item) => item.date === day);
                  const isQuickSlot = quickSlot?.groupKey === key && quickSlot.day === day;
                  return (
                    <td
                      key={`${key}-${day}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const assignmentId = event.dataTransfer.getData("text/assignment-id");
                        if (assignmentId) onDropAssignment(assignmentId, day);
                      }}
                      className="min-w-[210px] border-l border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] align-top"
                    >
                      <div className="space-y-2 p-2">
                        {dayItems.length === 0 ? (
                          isQuickSlot ? (
                            <div className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-brand-500)] bg-[var(--color-surface-elevated)] p-2" onClick={(event) => event.stopPropagation()}>
                              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Add assignment · {label}</p>
                              <Input aria-label="Assignment name" placeholder="Assignment name" value={quickForm.title} onChange={(event) => setQuickForm((current) => ({ ...current, title: event.target.value }))} />
                              <Select aria-label="Assignment project" value={quickForm.projectId} onChange={(event) => setQuickForm((current) => ({ ...current, projectId: event.target.value }))}>
                                {metadata?.projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                              </Select>
                              <Select aria-label="Required trade" value={quickForm.requiredTrade} onChange={(event) => setQuickForm((current) => ({ ...current, requiredTrade: event.target.value }))}>
                                {(metadata?.tradeOptions.length ? metadata.tradeOptions : ["General Labor"]).map((trade) => <option key={trade} value={trade}>{trade}</option>)}
                              </Select>
                              <div className="grid grid-cols-2 gap-2">
                                <Input aria-label="Start time" type="time" value={quickForm.startTime} onChange={(event) => setQuickForm((current) => ({ ...current, startTime: event.target.value }))} />
                                <Input aria-label="End time" type="time" value={quickForm.endTime} onChange={(event) => setQuickForm((current) => ({ ...current, endTime: event.target.value }))} />
                              </div>
                              {saveError ? <p className="text-xs text-[var(--color-danger-700)]">{saveError}</p> : null}
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" type="button" onClick={() => setQuickSlot(null)}>Cancel</Button>
                                <Button size="sm" type="button" disabled={isSaving || !metadata} onClick={() => void saveQuickAssignment(groupAssignments)}>{isSaving ? "Saving..." : "Save"}</Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={groupBy !== "crew" || key === "unassigned-crew"}
                              onClick={() => openQuickAdd(key, day)}
                              className="w-full rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] p-2 text-left text-xs text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand-500)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)] disabled:cursor-default disabled:hover:border-[var(--color-border-subtle)] disabled:hover:bg-transparent"
                              aria-label={groupBy === "crew" ? `Add assignment for ${label} on ${day}` : undefined}
                            >
                              {groupBy === "crew" ? "+ Add assignment" : t("scheduling.empty.noAssignmentsInSlot")}
                            </button>
                          )
                        ) : (
                          dayItems.map((assignment) => (
                            <AssignmentCard key={assignment.id} assignment={assignment} draggable onDragStart={onDragStart} onSelect={onSelectAssignment} t={t} />
                          ))
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
