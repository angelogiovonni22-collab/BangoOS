import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock3, Flag, Hammer, ListChecks, ShieldCheck, Users, Wrench } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Input, Select } from "@/components/ui";
import type {
  ProjectExecutionCalendarEvent,
  ProjectExecutionIssue,
  ProjectExecutionNote,
  ProjectExecutionTask,
  ProjectExecutionTaskStatus,
} from "./types";

type ProjectExecutionWorkspaceProps = {
  projectId: string;
  projectName: string;
  tasks: ProjectExecutionTask[];
  issues: ProjectExecutionIssue[];
  notes: ProjectExecutionNote[];
  activity: Array<{ id: string; title: string; detail: string; occurredAt: string; tone: "neutral" | "info" | "warning" | "success" }>;
  calendarEvents: ProjectExecutionCalendarEvent[];
  inspectionMilestones: Array<{ id: string; label: string; status: string; date: string | null }>;
  crewAssignmentCount: number;
  completionPercent: number;
  progressLabel: string;
  openTasksCount: number;
  upcomingMilestonesCount: number;
  inspectionPendingCount: number;
  blockedCount: number;
};

type CalendarMode = "day" | "week" | "month";

export function ProjectExecutionWorkspace({
  projectId,
  projectName,
  tasks,
  issues,
  notes,
  activity,
  calendarEvents,
  inspectionMilestones,
  crewAssignmentCount,
  completionPercent,
  progressLabel,
  openTasksCount,
  upcomingMilestonesCount,
  inspectionPendingCount,
  blockedCount,
}: ProjectExecutionWorkspaceProps) {
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [privateNote, setPrivateNote] = useState("");

  const todayIso = new Date().toISOString().slice(0, 10);

  const todayTasks = tasks.filter((task) => task.dueDate === todayIso && task.status !== "completed");
  const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < todayIso && task.status !== "completed");
  const upcomingTasks = tasks.filter((task) => task.dueDate && task.dueDate > todayIso && task.status !== "completed").slice(0, 8);
  const blockedTasks = tasks.filter((task) => task.status === "blocked");
  const completedToday = tasks.filter((task) => task.status === "completed" && task.completedAt?.slice(0, 10) === todayIso);

  const milestones = tasks.filter((task) => task.kind === "milestone");
  const upcomingMilestones = milestones.filter((item) => item.dueDate && item.dueDate >= todayIso && item.status !== "completed").slice(0, 8);
  const completedMilestones = milestones.filter((item) => item.status === "completed").slice(0, 8);
  const lateMilestones = milestones.filter((item) => item.dueDate && item.dueDate < todayIso && item.status !== "completed").slice(0, 8);

  const calendarWindowStart = startOfMode(todayIso, calendarMode);
  const calendarWindowEnd = endOfMode(todayIso, calendarMode);
  const scopedCalendarEvents = calendarEvents
    .filter((item) => item.date >= calendarWindowStart && item.date <= calendarWindowEnd)
    .sort((left, right) => left.date.localeCompare(right.date));

  const noteGroups = useMemo(() => {
    return {
      general: notes.filter((note) => note.category === "general"),
      field: notes.filter((note) => note.category === "field"),
      office: notes.filter((note) => note.category === "office"),
      private: notes.filter((note) => note.category === "private"),
    };
  }, [notes]);

  const issueBuckets = useMemo(() => {
    const open = issues.filter((issue) => issue.status === "open");
    const resolved = issues.filter((issue) => issue.status === "resolved");
    const blocked = issues.filter((issue) => issue.status === "blocked");
    return { open, resolved, blocked };
  }, [issues]);

  const privateNotePreview = privateNote.trim();

  return (
    <div className="space-y-5">
      <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
        <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
          <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Project Execution Workspace</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
          <Widget label="Work Completion" value={`${completionPercent}%`} context={progressLabel} icon={<CheckCircle2 size={14} aria-hidden="true" />} />
          <Widget label="Open Tasks" value={`${openTasksCount}`} context="active tasks" icon={<ClipboardList size={14} aria-hidden="true" />} />
          <Widget label="Upcoming Milestones" value={`${upcomingMilestonesCount}`} context="next delivery targets" icon={<Flag size={14} aria-hidden="true" />} />
          <Widget label="Project Progress" value={`${tasks.filter((task) => task.status === "completed").length}/${tasks.length}`} context="completed task count" icon={<ListChecks size={14} aria-hidden="true" />} />
          <Widget label="Inspection Status" value={`${inspectionPendingCount}`} context="pending inspections" icon={<ShieldCheck size={14} aria-hidden="true" />} />
          <Widget label="Crew Activity" value={`${crewAssignmentCount}`} context="scheduled crew assignments" icon={<Users size={14} aria-hidden="true" />} />
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
            <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Project Task System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="grid gap-3 lg:grid-cols-2">
              {tasks.slice(0, 10).map((task) => (
                <article key={task.id} className="rounded-[12px] border border-[var(--bos-border-light)] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">{task.title}</p>
                    <Badge tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--bos-text-medium-on-light)]">
                    <span>{task.kind}</span>
                    <span>Priority: {task.priority}</span>
                    <span>Assignee: {task.assigneeLabel}</span>
                    <span>Due: {task.dueDate || "No due date"}</span>
                    <span>Dependencies: {task.dependencyIds.length}</span>
                  </div>
                </article>
              ))}
            </div>
            <p className="text-xs text-[var(--bos-text-medium-on-light)]">Dependencies are captured as task architecture and reserved for future implementation.</p>
          </CardContent>
        </Card>

        <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
            <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5 p-4">
            <QuickAction href={`/projects/${projectId}?tab=tasks`} label="Create Task" />
            <QuickAction href={`/projects/${projectId}?tab=tasks`} label="Complete Task" />
            <QuickAction href={`/projects/${projectId}?tab=tasks#notes`} label="Add Note" />
            <QuickAction href={`/projects/${projectId}?tab=photos`} label="Upload Photo" />
            <QuickAction href={`/projects/${projectId}?tab=inspections`} label="Schedule Inspection" />
            <QuickAction href={`/projects/${projectId}?tab=crew`} label="Assign Crew" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
            <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Today Work</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5 p-4 sm:grid-cols-2">
            <ListCount label="Today Tasks" value={todayTasks.length} icon={<Clock3 size={14} aria-hidden="true" />} />
            <ListCount label="Overdue Tasks" value={overdueTasks.length} icon={<AlertTriangle size={14} aria-hidden="true" />} />
            <ListCount label="Upcoming Tasks" value={upcomingTasks.length} icon={<CalendarDays size={14} aria-hidden="true" />} />
            <ListCount label="Blocked Work" value={blockedTasks.length} icon={<Wrench size={14} aria-hidden="true" />} />
            <ListCount label="Completed Today" value={completedToday.length} icon={<CheckCircle2 size={14} aria-hidden="true" />} />
          </CardContent>
        </Card>

        <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
            <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Milestone Tracker</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
            <MilestoneList title="Upcoming" items={upcomingMilestones.map((item) => `${item.title} (${item.dueDate || "No date"})`)} />
            <MilestoneList title="Completed" items={completedMilestones.map((item) => item.title)} />
            <MilestoneList title="Late" items={lateMilestones.map((item) => `${item.title} (${item.dueDate || "No date"})`)} />
            <MilestoneList title="Inspection Milestones" items={inspectionMilestones.map((item) => `${item.label} (${item.status}) ${item.date || "No date"}`)} />
          </CardContent>
        </Card>
      </div>

      <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
        <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Project Calendar</CardTitle>
            <div className="inline-flex items-center gap-2">
              <Select value={calendarMode} onChange={(event) => setCalendarMode(event.target.value as CalendarMode)}>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 p-4">
          {scopedCalendarEvents.map((event) => (
            <article key={event.id} className="flex items-start justify-between gap-3 rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{event.title}</p>
                <p className="text-xs text-[var(--bos-text-medium-on-light)]">{event.date}</p>
              </div>
              <Badge tone={calendarEventTone(event.type)}>{event.type}</Badge>
            </article>
          ))}
          {scopedCalendarEvents.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No calendar events in this range.</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
            <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Project Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 p-4">
            {activity.slice(0, 16).map((item) => (
              <article key={item.id} className="rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{item.title}</p>
                  <Badge tone={activityTone(item.tone)}>{item.tone}</Badge>
                </div>
                <p className="text-sm text-[var(--bos-text-medium-on-light)]">{item.detail}</p>
                <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">{item.occurredAt}</p>
              </article>
            ))}
            {activity.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No activity records yet.</p> : null}
          </CardContent>
        </Card>

        <Card as="section" id="notes" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
            <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Project Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <NoteGroup title="General Notes" notes={noteGroups.general} />
            <NoteGroup title="Field Notes" notes={noteGroups.field} />
            <NoteGroup title="Office Notes" notes={noteGroups.office} />
            <NoteGroup title="Private Notes" notes={noteGroups.private} />
            <div className="rounded-[11px] border border-[var(--bos-border-light)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">Draft Private Note</p>
              <Input value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} placeholder="Write private note draft" />
              {privateNotePreview ? <p className="mt-2 text-sm text-[var(--bos-text-medium-on-light)]">{privateNotePreview}</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card as="section" variant="elevated" className="rounded-[18px] border border-[var(--bos-border-light)]">
        <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f2f7fd)]">
          <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Project Issues</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <IssueMetric label="Open Issues" value={issueBuckets.open.length} tone="warning" />
            <IssueMetric label="Resolved Issues" value={issueBuckets.resolved.length} tone="success" />
            <IssueMetric label="Blocked Work" value={issueBuckets.blocked.length + blockedCount} tone="danger" />
          </div>
          {issues.slice(0, 12).map((issue) => (
            <article key={issue.id} className="rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{issue.title}</p>
                <Badge tone={issueStatusTone(issue.status)}>{issue.status}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--bos-text-medium-on-light)]">
                <span>Owner: {issue.ownerLabel}</span>
                <span>Priority: {issue.priority}</span>
                <span>Due: {issue.dueDate || "No date"}</span>
              </div>
            </article>
          ))}
          {issues.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No issues logged.</p> : null}
        </CardContent>
      </Card>

      <div className="rounded-[12px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5 text-xs text-[var(--bos-text-medium-on-light)]">
        Active project: {projectName}
      </div>
    </div>
  );
}

function Widget({ label, value, context, icon }: { label: string; value: string; context: string; icon: React.ReactNode }) {
  return (
    <article className="rounded-[12px] border border-[var(--bos-border-light)] bg-white p-3">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{icon}{label}</p>
      <p className="mt-1 text-[1.1rem] font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p>
      <p className="text-xs text-[var(--bos-text-medium-on-light)]">{context}</p>
    </article>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center justify-between rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5 text-sm font-semibold text-[var(--bos-text-strong-on-light)] hover:bg-[var(--color-neutral-50)]">
      <span>{label}</span>
      <Hammer size={14} aria-hidden="true" />
    </Link>
  );
}

function ListCount({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <article className="flex items-center justify-between rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{icon}{label}</p>
      <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p>
    </article>
  );
}

function MilestoneList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[11px] border border-[var(--bos-border-light)] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{title}</p>
      <div className="mt-2 space-y-1.5">
        {items.slice(0, 5).map((item, index) => (
          <p key={`${title}-${index}`} className="text-sm text-[var(--bos-text-strong-on-light)]">{item}</p>
        ))}
        {items.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No records.</p> : null}
      </div>
    </section>
  );
}

function NoteGroup({ title, notes }: { title: string; notes: ProjectExecutionNote[] }) {
  return (
    <section className="rounded-[11px] border border-[var(--bos-border-light)] bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{title}</p>
      <div className="mt-2 space-y-2">
        {notes.slice(0, 3).map((note) => (
          <article key={note.id} className="rounded-[9px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-2.5 py-2">
            <p className="text-sm text-[var(--bos-text-strong-on-light)]">{note.body}</p>
            <p className="text-xs text-[var(--bos-text-medium-on-light)]">{note.createdAt}</p>
          </article>
        ))}
        {notes.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No notes.</p> : null}
      </div>
    </section>
  );
}

function IssueMetric({ label, value, tone }: { label: string; value: number; tone: "warning" | "success" | "danger" }) {
  return (
    <article className="flex items-center justify-between rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
      <p className="text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{label}</p>
      <Badge tone={tone}>{value}</Badge>
    </article>
  );
}

function taskStatusTone(status: ProjectExecutionTaskStatus) {
  if (status === "completed") {
    return "success" as const;
  }

  if (status === "blocked") {
    return "danger" as const;
  }

  if (status === "waiting") {
    return "warning" as const;
  }

  if (status === "in_progress") {
    return "info" as const;
  }

  return "neutral" as const;
}

function taskStatusLabel(status: ProjectExecutionTaskStatus) {
  if (status === "not_started") {
    return "Not Started";
  }

  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "waiting") {
    return "Waiting";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Completed";
}

function calendarEventTone(type: ProjectExecutionCalendarEvent["type"]) {
  if (type === "inspection") {
    return "warning" as const;
  }

  if (type === "crew_assignment") {
    return "info" as const;
  }

  if (type === "milestone") {
    return "success" as const;
  }

  return "neutral" as const;
}

function activityTone(tone: "neutral" | "info" | "warning" | "success") {
  if (tone === "info") {
    return "info" as const;
  }

  if (tone === "warning") {
    return "warning" as const;
  }

  if (tone === "success") {
    return "success" as const;
  }

  return "neutral" as const;
}

function issueStatusTone(status: ProjectExecutionIssue["status"]) {
  if (status === "resolved") {
    return "success" as const;
  }

  if (status === "blocked") {
    return "danger" as const;
  }

  return "warning" as const;
}

function startOfMode(todayIso: string, mode: CalendarMode) {
  const date = new Date(`${todayIso}T00:00:00`);

  if (mode === "day") {
    return todayIso;
  }

  if (mode === "week") {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date.toISOString().slice(0, 10);
  }

  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function endOfMode(todayIso: string, mode: CalendarMode) {
  const date = new Date(`${todayIso}T00:00:00`);

  if (mode === "day") {
    return todayIso;
  }

  if (mode === "week") {
    const day = date.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    date.setDate(date.getDate() + diff);
    return date.toISOString().slice(0, 10);
  }

  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return date.toISOString().slice(0, 10);
}
