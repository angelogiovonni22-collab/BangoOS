"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
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

const interactiveCardClass = "transition duration-150 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500";

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
    if (!draggingEmployeeId || disabled) return;

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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Daily Assignment Board</h3>
          <p className="text-sm text-[var(--text-secondary)]">Drag employees between crew lanes to reassign workforce coverage for today.</p>
        </div>
        <Link href="/crews" className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
          Manage crews <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-3 xl:grid-cols-4">
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => setDraggingEmployeeId(null)}
          className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] bg-[var(--surface-default)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Employee Pool</p>
            <Link href="/employees" className="text-xs font-semibold text-blue-500 hover:underline">Employees</Link>
          </div>
          <div className="mt-2 space-y-2">
            {(employeesByCrew.get("unassigned") || []).map((employee) => (
              <article
                key={employee.employeeId}
                draggable={!disabled}
                onDragStart={() => setDraggingEmployeeId(employee.employeeId)}
                className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2 transition hover:border-blue-400"
              >
                <Link href={`/employees/${employee.employeeId}`} className="text-sm font-medium text-[var(--text-primary)] hover:underline">{employee.employeeName}</Link>
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
            onDrop={() => void handleDropToCrew(crew.crewId)}
            className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3 transition hover:border-blue-400"
          >
            <div className="flex items-center justify-between gap-2">
              <Link href={`/crews/${crew.crewId}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">{crew.crewName}</Link>
              <Badge tone={crew.shiftStatus === "working" ? "success" : crew.shiftStatus === "traveling" ? "info" : "neutral"}>{crew.shiftStatus}</Badge>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{crew.currentProjectName || "Unassigned project"}</p>
            <div className="mt-2 space-y-2">
              {(employeesByCrew.get(crew.crewId) || []).map((employee) => (
                <article
                  key={employee.employeeId}
                  draggable={!disabled}
                  onDragStart={() => setDraggingEmployeeId(employee.employeeId)}
                  className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2 transition hover:border-blue-400"
                >
                  <Link href={`/employees/${employee.employeeId}`} className="text-sm font-medium text-[var(--text-primary)] hover:underline">{employee.employeeName}</Link>
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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Crew Detail Workspace</h3>
          <p className="text-sm text-[var(--text-secondary)]">Crew members, supervisor, equipment, schedule, notes, and labor-hour context.</p>
        </div>
        <Link href="/crews" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline">Open crews <ArrowUpRight size={13} aria-hidden="true" /></Link>
      </div>
      {crews.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {crews.map((crew) => {
            const todaysAssignments = assignments.filter((assignment) => assignment.crewId === crew.crewId);
            const plannedHours = todaysAssignments.reduce((sum, assignment) => sum + Math.max(0, assignment.requiredHeadcount * 8), 0);

            return (
              <Link key={crew.crewId} href={`/crews/${crew.crewId}`} className={`group rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3 ${interactiveCardClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-blue-500">{crew.crewName}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={crew.shiftStatus === "working" ? "success" : crew.shiftStatus === "traveling" ? "info" : "neutral"}>{crew.shiftStatus}</Badge>
                    <ArrowUpRight size={14} className="text-[var(--text-secondary)] group-hover:text-blue-500" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Supervisor: {crew.supervisorName || "Unassigned"}</p>
                <p className="text-xs text-[var(--text-secondary)]">Equipment assigned: {crew.equipmentAssignedCount}</p>
                <p className="text-xs text-[var(--text-secondary)]">Today&apos;s assignments: {todaysAssignments.length}</p>
                <p className="text-xs text-[var(--text-secondary)]">Planned labor hours: {plannedHours}</p>
                <p className="text-xs text-[var(--text-secondary)]">Schedule progress: {crew.shiftProgressPercent}%</p>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">No active crew records are available. Open Crews to create or activate a crew.</p>
      )}
    </Card>
  );
}

function EmployeeWorkspace({ data }: { data: WorkforceOperationsDashboardData }) {
  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Employee Detail Workspace</h3>
          <p className="text-sm text-[var(--text-secondary)]">Assignments, availability, PTO/off-day status, contact visibility, and current project context.</p>
        </div>
        <Link href="/employees" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline">Open employees <ArrowUpRight size={13} aria-hidden="true" /></Link>
      </div>
      {data.employeeStatus.length > 0 ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {data.employeeStatus.slice(0, 12).map((employee) => (
            <Link key={employee.employeeId} href={`/employees/${employee.employeeId}`} className={`group rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3 ${interactiveCardClass}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-blue-500">{employee.employeeName}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={employee.currentStatus === "working" ? "success" : employee.currentStatus === "available" ? "info" : "warning"}>{employee.currentStatus}</Badge>
                  <ArrowUpRight size={14} className="text-[var(--text-secondary)] group-hover:text-blue-500" aria-hidden="true" />
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">Current project: {employee.assignedJobName || "Unassigned"}</p>
              <p className="text-xs text-[var(--text-secondary)]">Crew: {employee.assignedCrewName || "None"}</p>
              <p className="text-xs text-[var(--text-secondary)]">Hours today: {employee.timeTodayHours.toFixed(1)}</p>
              <p className="text-xs text-[var(--text-secondary)]">PTO/off status: {employee.currentStatus === "off" ? "Off/PTO" : "Active"}</p>
              <p className="text-xs text-[var(--text-secondary)]">Contact: {employee.contactPhone || "Available in employee profile"}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-subtle)] p-4 text-sm text-[var(--text-secondary)]">No active employee records are available. Open Employees to manage workforce records.</p>
      )}
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
  const [equipmentIds, setEquipmentIds] = useState("");
  const hasCrewOptions = data.options.crewOptions.length > 0;

  return (
    <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Equipment Assignment</h3>
          <p className="text-sm text-[var(--text-secondary)]">Assign equipment to a crew. Project-level equipment context remains managed in the Equipment module.</p>
        </div>
        <Link href="/equipment" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:underline">Open equipment <ArrowUpRight size={13} aria-hidden="true" /></Link>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(260px,2fr)_auto] md:items-end">
        <label className="grid gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          Crew
          <Select value={crewId} onChange={(event) => setCrewId(event.target.value)} aria-label="Equipment crew" disabled={!hasCrewOptions || disabled}>
            {!hasCrewOptions ? <option value="">No crews available</option> : null}
            {data.options.crewOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Select>
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
          Equipment IDs
          <Input value={equipmentIds} onChange={(event) => setEquipmentIds(event.target.value)} placeholder="Equipment IDs, comma-separated" aria-label="Equipment IDs" disabled={disabled} />
        </label>

        <Button
          variant="secondary"
          className="transition hover:-translate-y-0.5 hover:shadow-sm"
          disabled={disabled || !crewId || !equipmentIds.trim()}
          onClick={() => void onAssignEquipment({
            crewId,
            equipmentIds: equipmentIds.split(",").map((value) => value.trim()).filter(Boolean),
          })}
        >
          Assign to crew
        </Button>
      </div>

      <p className="mt-3 text-xs text-[var(--text-secondary)]">Assignment history and availability remain visible in Equipment and crew profiles.</p>
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
        <Metric href="/employees" label="Acknowledgements" value={String(acknowledgements)} detail="Workers currently active" />
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
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/schedule" className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
            Full schedule <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
          <Button aria-pressed={calendarView === "day"} size="sm" variant={calendarView === "day" ? "secondary" : "ghost"} onClick={() => setCalendarView("day")}>Day</Button>
          <Button aria-pressed={calendarView === "week"} size="sm" variant={calendarView === "week" ? "secondary" : "ghost"} onClick={() => setCalendarView("week")}>Week</Button>
          <Button aria-pressed={calendarView === "month"} size="sm" variant={calendarView === "month" ? "secondary" : "ghost"} onClick={() => setCalendarView("month")}>Month</Button>
        </div>
      </div>

      <ScheduleCalendar
        view={calendarView}
        groupBy="crew"
        date={scheduling.periodDate}
        assignments={scheduling.filteredAssignments}
        locale="en"
        onMoveAssignment={(assignmentId, targetDate) => void scheduling.moveAssignmentCard(assignmentId, { date: targetDate })}
        onQuickMoveShift={(assignmentId, shift) => void scheduling.moveAssignmentCard(assignmentId, { shift })}
        t={schedulingLabel}
      />
    </Card>
  );
}

function Metric({ href, label, value, detail }: { href?: string; label: string; value: string; detail: string }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</p>
        {href ? <ArrowUpRight size={14} className="text-[var(--text-secondary)] group-hover:text-blue-500" aria-hidden="true" /> : null}
      </div>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>
    </>
  );

  if (href) {
    return <Link href={href} className={`group rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3 ${interactiveCardClass}`}>{content}</Link>;
  }

  return <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">{content}</div>;
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
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">CrewOS Supervisor Operations Workspace</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Operational tools for calendar planning, assignment control, workforce coordination, equipment, and safety.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info">Generated {new Date(data.generatedAt).toLocaleTimeString()}</Badge>
          <Button variant="secondary" className="transition hover:-translate-y-0.5 hover:shadow-sm" disabled={isMutating} onClick={() => void refresh()}>Refresh Data</Button>
        </div>
      </div>

      <nav aria-label="Operations workspace shortcuts" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <WorkspaceShortcut href="/schedule" label="Schedule" detail="Crew and project planning" />
        <WorkspaceShortcut href="/crews" label="Crews" detail="Crew profiles and assignments" />
        <WorkspaceShortcut href="/employees" label="Employees" detail="Workforce records and status" />
        <WorkspaceShortcut href="/equipment" label="Equipment" detail="Equipment availability and assignments" />
      </nav>

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
            {data.partialNotices.map((notice) => <li key={notice}>- {notice}</li>)}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric href="/crews" label="Active crews" value={String(data.summary.activeCrews)} detail="Crews currently available" />
        <Metric href="/employees" label="Active employees" value={String(data.summary.activeEmployees)} detail="Workforce headcount today" />
        <Metric href="/schedule" label="Open assignments" value={String(data.summary.openAssignments)} detail="Needs staffing attention" />
        <Metric href="/employees" label="Attendance issues" value={String(data.summary.employeesLate + data.summary.employeesAbsent)} detail="Late + absent workers" />
      </div>

      <CrewCalendarWorkspace />

      <DailyAssignmentBoard data={data} disabled={isMutating} onReassign={reassignEmployeeToCrew} />
      <CrewWorkspace crews={data.crewStatus} assignments={data.dailyAssignments} />
      <EmployeeWorkspace data={data} />
      <EquipmentAssignmentWorkspace data={data} disabled={isMutating} onAssignEquipment={assignEquipmentToCrew} />
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

function WorkspaceShortcut({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className={`group flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 ${interactiveCardClass}`}>
      <span>
        <span className="block text-sm font-semibold text-[var(--text-primary)] group-hover:text-blue-500">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{detail}</span>
      </span>
      <ArrowUpRight size={16} className="shrink-0 text-[var(--text-secondary)] group-hover:text-blue-500" aria-hidden="true" />
    </Link>
  );
}
