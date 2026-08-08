"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, HardHat, Users } from "./crew-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ScheduleCalendar } from "@/components/scheduling/schedule-calendar";
import { useWorkforceOperationsDashboard } from "@/lib/crews/use-workforce-operations-dashboard";
import { useScheduling } from "@/lib/scheduling/use-scheduling";
import type {
  CrewStatusRow,
  WorkforceOperationsDashboardData,
} from "@/lib/crews/workforce-operations-types";
import type { ScheduleView } from "@/lib/scheduling";

function schedulingLabel(key: string, params?: Record<string, string | number>) {
  if (key === "scheduling.calendar.title") return "Crew Calendar";
  if (key === "scheduling.shift.day") return "Day";
  if (key === "scheduling.shift.swing") return "Swing";
  if (key === "scheduling.shift.night") return "Night";
  if (key === "scheduling.views.dayTimeline") return "Day Timeline";
  if (key === "scheduling.empty.noAssignmentsInSlot") return "Drop assignment here";
  if (key.startsWith("scheduling.group.")) return "Group";
  if (key === "scheduling.month.more") {
    const count = typeof params?.count === "number" ? params.count : 0;
    return `+${count} more`;
  }

  if (key.startsWith("scheduling.assignmentStatus.")) {
    return key.replace("scheduling.assignmentStatus.", "").replaceAll("_", " ");
  }

  if (key.startsWith("scheduling.priority.")) {
    return key.replace("scheduling.priority.", "");
  }

  if (key === "scheduling.assignment.openShift") return "Open shift";
  return key;
}

function DailyAssignmentBoard({
  data,
  disabled,
  onReassign,
}: {
  data: WorkforceOperationsDashboardData;
  disabled: boolean;
  onReassign: (input: { employeeId: string; crewId: string; role: string; asPrimaryCrew: boolean }) => Promise<void>;
}) {
  const [draggingEmployeeId, setDraggingEmployeeId] = useState<string | null>(null);

  const employeesByCrew = useMemo(() => {
    const map = new Map<string, typeof data.employeeStatus>();
    for (const employee of data.employeeStatus) {
      const key = data.crewStatus.find((crew) => crew.crewName === employee.assignedCrewName)?.crewId || "unassigned";
      const existing = map.get(key) || [];
      existing.push(employee);
      map.set(key, existing);
    }

    return map;
  }, [data]);

  const handleDropToCrew = async (crewId: string) => {
    if (!draggingEmployeeId || disabled) {
      return;
    }

    await onReassign({
      employeeId: draggingEmployeeId,
      crewId,
      role: "Crew Member",
      asPrimaryCrew: true,
    });

    setDraggingEmployeeId(null);
  };

  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Daily Assignment Board</h3>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">Drag employees between crew lanes to reassign workforce coverage for today.</p>

      <div className="grid gap-3 xl:grid-cols-4">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            setDraggingEmployeeId(null);
          }}
          className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-default)] p-3"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Employee Pool</p>
          <div className="mt-2 space-y-2">
            {(employeesByCrew.get("unassigned") || []).map((employee) => (
              <article
                key={employee.employeeId}
                draggable={!disabled}
                onDragStart={() => setDraggingEmployeeId(employee.employeeId)}
                className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2"
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">{employee.employeeName}</p>
                <p className="text-xs text-[var(--text-secondary)]">{employee.currentStatus}</p>
              </article>
            ))}
            {(employeesByCrew.get("unassigned") || []).length === 0 ? <p className="text-xs text-[var(--text-secondary)]">No unassigned employees.</p> : null}
          </div>
        </div>

        {data.crewStatus.map((crew) => (
          <div
            key={crew.crewId}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              void handleDropToCrew(crew.crewId);
            }}
            className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{crew.crewName}</p>
              <Badge tone={crew.shiftStatus === "working" ? "success" : crew.shiftStatus === "traveling" ? "info" : "neutral"}>{crew.shiftStatus}</Badge>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{crew.currentProjectName || "Unassigned project"}</p>
            <div className="mt-2 space-y-2">
              {(employeesByCrew.get(crew.crewId) || []).map((employee) => (
                <article
                  key={employee.employeeId}
                  draggable={!disabled}
                  onDragStart={() => setDraggingEmployeeId(employee.employeeId)}
                  className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2"
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">{employee.employeeName}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{employee.assignedJobName || "No assignment"}</p>
                </article>
              ))}
              {(employeesByCrew.get(crew.crewId) || []).length === 0 ? <p className="text-xs text-[var(--text-secondary)]">Drop employee to assign.</p> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CrewWorkspace({ crews, assignments }: { crews: CrewStatusRow[]; assignments: WorkforceOperationsDashboardData["dailyAssignments"] }) {
  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Crew Detail Workspace</h3>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">Crew members, supervisor, equipment, schedule, notes, and labor-hour context.</p>
      <div className="grid gap-3 xl:grid-cols-2">
        {crews.map((crew) => {
          const todaysAssignments = assignments.filter((assignment) => assignment.crewId === crew.crewId);
          const plannedHours = todaysAssignments.reduce((sum, assignment) => sum + Math.max(0, assignment.requiredHeadcount * 8), 0);

          return (
            <article key={crew.crewId} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/crews/${crew.crewId}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">{crew.crewName}</Link>
                <Badge tone={crew.shiftStatus === "working" ? "success" : crew.shiftStatus === "traveling" ? "info" : "neutral"}>{crew.shiftStatus}</Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Supervisor: {crew.supervisorName || "Unassigned"}</p>
              <p className="text-xs text-[var(--text-secondary)]">Equipment assigned: {crew.equipmentAssignedCount}</p>
              <p className="text-xs text-[var(--text-secondary)]">Today&apos;s assignments: {todaysAssignments.length}</p>
              <p className="text-xs text-[var(--text-secondary)]">Planned labor hours: {plannedHours}</p>
              <p className="text-xs text-[var(--text-secondary)]">Schedule progress: {crew.shiftProgressPercent}%</p>
            </article>
          );
        })}
      </div>
    </Card>
  );
}

function EmployeeWorkspace({ data }: { data: WorkforceOperationsDashboardData }) {
  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Employee Detail Workspace</h3>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">Assignments, availability, PTO/off-day status, contact visibility, and current project context.</p>
      <div className="grid gap-3 xl:grid-cols-2">
        {data.employeeStatus.slice(0, 12).map((employee) => (
          <article key={employee.employeeId} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/employees/${employee.employeeId}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">{employee.employeeName}</Link>
              <Badge tone={employee.currentStatus === "working" ? "success" : employee.currentStatus === "available" ? "info" : "warning"}>{employee.currentStatus}</Badge>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Current project: {employee.assignedJobName || "Unassigned"}</p>
            <p className="text-xs text-[var(--text-secondary)]">Crew: {employee.assignedCrewName || "None"}</p>
            <p className="text-xs text-[var(--text-secondary)]">Hours today: {employee.timeTodayHours.toFixed(1)}</p>
            <p className="text-xs text-[var(--text-secondary)]">PTO/off status: {employee.currentStatus === "off" ? "Off/PTO" : "Active"}</p>
            <p className="text-xs text-[var(--text-secondary)]">Contact: {employee.contactPhone || "Available in employee profile"}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}

function EquipmentAssignmentWorkspace({
  data,
  disabled,
  onAssignEquipment,
}: {
  data: WorkforceOperationsDashboardData;
  disabled: boolean;
  onAssignEquipment: (input: { crewId: string; equipmentIds: string[] }) => Promise<void>;
}) {
  const [crewId, setCrewId] = useState(data.options.crewOptions[0]?.id || "");
  const [projectId, setProjectId] = useState(data.options.assignmentOptions[0]?.projectId || "");
  const [equipmentIds, setEquipmentIds] = useState("");

  const projectOptions = Array.from(
    new Map(data.options.assignmentOptions.map((option) => [option.projectId, option.projectName])).entries(),
  ).map(([id, label]) => ({ id, label }));

  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Equipment Assignment</h3>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">Assign equipment to crews and map assignment context to active projects.</p>

      <div className="grid gap-3 md:grid-cols-4">
        <Select value={crewId} onChange={(event) => setCrewId(event.target.value)} aria-label="Equipment crew">
          {data.options.crewOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </Select>

        <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Equipment project">
          {projectOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </Select>

        <Input value={equipmentIds} onChange={(event) => setEquipmentIds(event.target.value)} placeholder="Equipment IDs comma-separated" aria-label="Equipment IDs" />

        <Button
          variant="secondary"
          disabled={disabled || !crewId || !equipmentIds.trim()}
          onClick={() => void onAssignEquipment({
            crewId,
            equipmentIds: equipmentIds.split(",").map((value) => value.trim()).filter(Boolean),
          })}
        >
          Assign To Crew/Project
        </Button>
      </div>

      <p className="mt-2 text-xs text-[var(--text-secondary)]">Project context: {projectOptions.find((project) => project.id === projectId)?.label || "Not selected"}</p>
      <p className="text-xs text-[var(--text-secondary)]">Assignment history and availability remain visible in the Equipment module and crew profile equipment sections.</p>
    </Card>
  );
}

function DailyReportsWorkspace({ data }: { data: WorkforceOperationsDashboardData }) {
  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Daily Reports</h3>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">Capture manpower, completed work, delays, weather, and field notes.</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Manpower" value={String(data.summary.employeesClockedIn)} detail={`${data.summary.activeEmployees} active employees`} />
        <Metric label="Completed work" value={String(data.dailyAssignments.filter((item) => item.status === "completed").length)} detail="Completed assignments today" />
        <Metric label="Delays" value={String(data.assignmentConflicts.filter((item) => item.severity === "critical" || item.severity === "high").length)} detail="High-impact conflicts" />
        <Metric label="Weather/notes" value={String(data.dailyOperations.filter((row) => Boolean(row.crewNotes || row.supervisorNotes || row.safetyNotes)).length)} detail="Ops notes captured" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/daily-reports" className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">Open Daily Reports</Link>
        <Link href="/daily-reports/new" className="inline-flex items-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">Create Daily Report</Link>
      </div>
    </Card>
  );
}

function SafetyWorkspace({ data }: { data: WorkforceOperationsDashboardData }) {
  const toolboxTalks = data.dailyAssignments.filter((item) => item.title.toLowerCase().includes("toolbox")).length;
  const inspections = data.dailyAssignments.filter((item) => item.title.toLowerCase().includes("inspection")).length;
  const incidents = data.overdueItems.safetyFlags.length;
  const acknowledgements = data.employeeStatus.filter((employee) => employee.currentStatus === "working").length;

  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">Safety Workspace</h3>
      <p className="mb-4 text-sm text-[var(--text-secondary)]">Track toolbox talks, inspections, incidents, and daily acknowledgements for field teams.</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Toolbox talks" value={String(toolboxTalks)} detail="Scheduled/recorded today" />
        <Metric label="Inspections" value={String(inspections)} detail="Inspection activities" />
        <Metric label="Incidents" value={String(incidents)} detail="Safety flags requiring action" />
        <Metric label="Acknowledgements" value={String(acknowledgements)} detail="Workers currently active" />
      </div>

      <div className="mt-4 space-y-2">
        {data.overdueItems.safetyFlags.slice(0, 6).map((item) => (
          <div key={item.assignmentId} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-2">
            <p className="text-sm font-medium text-[var(--text-primary)]">{item.assignmentTitle}</p>
            <p className="text-xs text-[var(--text-secondary)]">Assignment id: {item.assignmentId}</p>
          </div>
        ))}
        {data.overdueItems.safetyFlags.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">No safety incidents flagged today.</p> : null}
      </div>
    </Card>
  );
}

function CrewCalendarWorkspace() {
  const scheduling = useScheduling();
  const [calendarView, setCalendarView] = useState<ScheduleView>("week");

  if (scheduling.isLoading && !scheduling.payload) {
    return (
      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
        <p className="text-sm text-[var(--text-secondary)]">Loading crew calendar...</p>
      </Card>
    );
  }

  if (!scheduling.payload) {
    return (
      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
        <p className="text-sm text-[var(--text-secondary)]">Crew calendar is temporarily unavailable.</p>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Crew Calendar</h3>
          <p className="text-sm text-[var(--text-secondary)]">Day, week, and month crew scheduling views.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={calendarView === "day" ? "secondary" : "ghost"} onClick={() => setCalendarView("day")}>Day</Button>
          <Button size="sm" variant={calendarView === "week" ? "secondary" : "ghost"} onClick={() => setCalendarView("week")}>Week</Button>
          <Button size="sm" variant={calendarView === "month" ? "secondary" : "ghost"} onClick={() => setCalendarView("month")}>Month</Button>
        </div>
      </div>

      <ScheduleCalendar
        view={calendarView}
        groupBy="crew"
        date={scheduling.periodDate}
        assignments={scheduling.filteredAssignments}
        onMoveAssignment={(assignmentId, targetDate) => {
          void scheduling.moveAssignmentCard(assignmentId, { date: targetDate });
        }}
        onQuickMoveShift={(assignmentId, shift) => {
          void scheduling.moveAssignmentCard(assignmentId, { shift });
        }}
        t={schedulingLabel}
      />
    </Card>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

export function WorkforceOperationsDashboard() {
  const {
    data,
    isLoading,
    isMutating,
    errorMessage,
    actionMessage,
    refresh,
    reassignEmployeeToCrew,
    assignEquipmentToCrew,
  } = useWorkforceOperationsDashboard();

  if (isLoading) {
    return (
      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-6">
        <p className="text-sm text-[var(--text-secondary)]">Loading CrewOS supervisor workspace...</p>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <ErrorState
        title="Unable to load CrewOS workspace"
        description="Please retry. If this continues, verify workspace access and workforce service health."
        action={<Button variant="secondary" onClick={() => void refresh()}>Retry</Button>}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No workforce operations data"
        description="CrewOS could not find operations data yet for this company."
        action={<Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">CrewOS Supervisor Operations Workspace</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Operational tools for calendar planning, assignment control, workforce coordination, equipment, daily reporting, and safety.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info">Generated {new Date(data.generatedAt).toLocaleTimeString()}</Badge>
          <Button variant="secondary" disabled={isMutating} onClick={() => void refresh()}>Refresh Data</Button>
        </div>
      </div>

      {actionMessage ? (
        <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-3">
          <p className="text-sm font-medium text-[var(--color-success-700)]">{actionMessage}</p>
        </Card>
      ) : null}

      {data.partialNotices.length > 0 ? (
        <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
          <div className="mb-2 flex items-center gap-2 text-[var(--color-warning-700)]">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-semibold">Partial Data Notices</p>
          </div>
          <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
            {data.partialNotices.map((notice) => (
              <li key={notice}>- {notice}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Active crews" value={String(data.summary.activeCrews)} detail="Crews currently available" />
        <Metric label="Active employees" value={String(data.summary.activeEmployees)} detail="Workforce headcount today" />
        <Metric label="Open assignments" value={String(data.summary.openAssignments)} detail="Needs staffing attention" />
        <Metric label="Attendance issues" value={String(data.summary.employeesLate + data.summary.employeesAbsent)} detail="Late + absent workers" />
      </div>

      <CrewCalendarWorkspace />

      <DailyAssignmentBoard
        data={data}
        disabled={isMutating}
        onReassign={reassignEmployeeToCrew}
      />

      <CrewWorkspace crews={data.crewStatus} assignments={data.dailyAssignments} />
      <EmployeeWorkspace data={data} />
      <EquipmentAssignmentWorkspace data={data} disabled={isMutating} onAssignEquipment={assignEquipmentToCrew} />
      <DailyReportsWorkspace data={data} />
      <SafetyWorkspace data={data} />

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <HardHat className="h-4 w-4 text-[var(--text-secondary)]" />
          <Users className="h-4 w-4 text-[var(--text-secondary)]" />
          <p className="text-[var(--text-secondary)]">Future integration interfaces for GPS, Time Clock, and Orion remain provider-based and are not implemented in this phase.</p>
        </div>
      </Card>
    </div>
  );
}
