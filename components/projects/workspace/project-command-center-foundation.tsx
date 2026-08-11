import Link from "next/link";
import { Activity, ClipboardList, ShieldCheck, Wrench } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { LocationForecastCard } from "@/components/location-intelligence";
import { WorkspaceActivityFeed, WorkspaceQuickActions, WorkspaceSection, WorkspaceTimeline, WorkspaceWidget } from "@/components/workspace";

type TaskSummary = {
  id: string;
  title: string;
  status: string;
  planned_finish: string | null;
};

export type CommandCenterTimelineEntry = {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  tone: "neutral" | "info" | "warning" | "success";
};

type ProjectCommandCenterFoundationProps = {
  projectId: string;
  projectName: string;
  jobsiteAddress: string;
  tasks: TaskSummary[];
  budgetLabel: string;
  spentLabel: string;
  remainingLabel: string;
  estimatesCount: number;
  changeOrdersCount: number;
  invoicesCount: number;
  photosCount: number;
  permitsCount: number;
  inspectionsCount: number;
  dailyReportsCount: number;
  openPunchItemsCount: number;
  openPermitsCount: number;
  pendingInspectionsCount: number;
  closeoutStatusLabel: string;
  closeoutReady: boolean;
  activityItems: Array<{ id: string; title: string; detail: string; timestamp: string; tone: string }>;
  timelineEntries: CommandCenterTimelineEntry[];
};

export function ProjectCommandCenterFoundation({
  projectId,
  projectName,
  jobsiteAddress,
  tasks,
  budgetLabel,
  spentLabel,
  remainingLabel,
  estimatesCount,
  changeOrdersCount,
  invoicesCount,
  photosCount,
  permitsCount,
  inspectionsCount,
  dailyReportsCount,
  openPunchItemsCount,
  openPermitsCount,
  pendingInspectionsCount,
  closeoutStatusLabel,
  closeoutReady,
  activityItems,
  timelineEntries,
}: ProjectCommandCenterFoundationProps) {
  const nowDate = new Date().toISOString().slice(0, 10);
  const grouped = groupTasksForBoard(tasks);
  const tasksDueToday = tasks.filter((task) => task.planned_finish === nowDate).length;
  const activeTasks = grouped.inProgress.length + grouped.blocked.length;
  const completionRate = tasks.length ? Math.round((grouped.completed.length / tasks.length) * 100) : 0;

  const healthWidgets = [
    { label: "Schedule", value: `${completionRate}%`, context: `${grouped.completed.length}/${tasks.length} tasks complete` },
    { label: "Field Quality", value: `${pendingInspectionsCount}`, context: "pending inspections" },
    { label: "Permit Risk", value: `${openPermitsCount}`, context: "open permits" },
    { label: "Closeout", value: closeoutReady ? "Ready" : "In Progress", context: closeoutStatusLabel },
  ];

  const quickActions = [
    { id: "tasks", href: `/projects/${projectId}?tab=tasks`, label: "Open Task Planner" },
    { id: "daily", href: `/projects/${projectId}?tab=daily_logs`, label: "Review Daily Logs" },
    { id: "photos", href: `/projects/${projectId}?tab=photos`, label: "Open Photo Log" },
    { id: "financials", href: `/projects/${projectId}?tab=financials`, label: "View Financials" },
    { id: "docs", href: `/projects/${projectId}?tab=documents`, label: "Go To Documents" },
    { id: "subs", href: `/projects/${projectId}?tab=subcontractors`, label: "Manage Subcontractors" },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceSection title="Project Command Center" className="rounded-[18px] border border-[var(--bos-border-light)]" contentClassName="p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {healthWidgets.map((widget) => (
            <WorkspaceWidget key={widget.label} label={widget.label} value={widget.value} context={widget.context} />
          ))}
        </div>
      </WorkspaceSection>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <WorkspaceSection title="Today's Operations" className="rounded-[18px] border border-[var(--bos-border-light)]" action={<Badge tone="info">{projectName}</Badge>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <WorkspaceWidget icon={<ClipboardList size={15} aria-hidden="true" />} label="Due Today" value={`${tasksDueToday}`} context="tasks due" />
            <WorkspaceWidget icon={<Activity size={15} aria-hidden="true" />} label="Active Work" value={`${activeTasks}`} context="in progress or blocked" />
            <WorkspaceWidget icon={<ShieldCheck size={15} aria-hidden="true" />} label="Inspections" value={`${pendingInspectionsCount}`} context="pending review" />
            <WorkspaceWidget icon={<Wrench size={15} aria-hidden="true" />} label="Punch List" value={`${openPunchItemsCount}`} context="open items" />
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Quick Actions" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <WorkspaceQuickActions actions={quickActions} />
        </WorkspaceSection>
      </div>

      <LocationForecastCard projectId={projectId} fallbackDirectionsAddress={jobsiteAddress} title="Jobsite Weather and Directions" showMap />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <WorkspaceSection title="Task Board" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <div className="grid gap-3 lg:grid-cols-4">
            <TaskColumn title="Planned" tasks={grouped.planned} tone="neutral" />
            <TaskColumn title="In Progress" tasks={grouped.inProgress} tone="info" />
            <TaskColumn title="Blocked" tasks={grouped.blocked} tone="warning" />
            <TaskColumn title="Completed" tasks={grouped.completed} tone="success" />
          </div>
        </WorkspaceSection>

        <WorkspaceSection title="Document Center" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <div className="grid gap-2.5">
            <DocCard label="Daily Reports" value={dailyReportsCount} />
            <DocCard label="Photos" value={photosCount} />
            <DocCard label="Permits" value={permitsCount} />
            <DocCard label="Inspections" value={inspectionsCount} />
            <DocCard label="Estimates" value={estimatesCount} />
            <DocCard label="Change Orders" value={changeOrdersCount} />
          </div>
        </WorkspaceSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <WorkspaceSection title="Financial Snapshot" className="rounded-[18px] border border-[var(--bos-border-light)]">
          <div className="space-y-2.5">
            <Row label="Budget" value={budgetLabel} />
            <Row label="Spent" value={spentLabel} />
            <Row label="Remaining" value={remainingLabel} />
            <Row label="Invoices" value={`${invoicesCount}`} />
            <Row label="Change Orders" value={`${changeOrdersCount}`} />
          </div>
        </WorkspaceSection>

        <WorkspaceActivityFeed
          title="Activity Feed"
          items={activityItems.map((item) => ({
            id: item.id,
            title: item.title,
            detail: item.detail,
            timestamp: item.timestamp,
            tone: item.tone === "success" ? "success" : item.tone === "warning" ? "warning" : item.tone === "info" ? "info" : "neutral",
          }))}
          emptyLabel="No project activity logged yet."
        />
      </div>

      <WorkspaceTimeline
        title="Project Timeline"
        items={timelineEntries.map((entry) => ({
          id: entry.id,
          title: entry.title,
          detail: entry.detail,
          timestamp: entry.occurredAt,
          tone: entry.tone === "success" ? "success" : entry.tone === "warning" ? "warning" : entry.tone === "info" ? "info" : "neutral",
        }))}
        emptyLabel="No timeline events yet."
      />

      <div className="pt-2">
        <Link href={`/projects/${projectId}?tab=activity`}>
          <Button variant="outline" size="sm">Open Full Activity Workspace</Button>
        </Link>
      </div>
    </div>
  );
}

function TaskColumn({ title, tasks, tone }: { title: string; tasks: TaskSummary[]; tone: "neutral" | "info" | "warning" | "success" }) {
  return (
    <section className="rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{title}</p>
        <Badge tone={badgeTone(tone)}>{tasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {tasks.slice(0, 4).map((task) => (
          <article key={task.id} className="rounded-[10px] border border-[var(--bos-border-light)] bg-white px-2.5 py-2">
            <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{task.title}</p>
            <p className="text-xs text-[var(--bos-text-medium-on-light)]">{task.planned_finish || "No due date"}</p>
          </article>
        ))}
        {tasks.length === 0 ? <p className="text-xs text-[var(--bos-text-medium-on-light)]">No tasks in this lane.</p> : null}
      </div>
    </section>
  );
}

function DocCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="flex items-center justify-between rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
      <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{label}</p>
      <Badge tone="neutral">{value}</Badge>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[11px] border border-[var(--bos-border-light)] bg-white px-3 py-2.5">
      <p className="text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{label}</p>
      <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p>
    </div>
  );
}

function groupTasksForBoard(tasks: TaskSummary[]) {
  const planned: TaskSummary[] = [];
  const inProgress: TaskSummary[] = [];
  const blocked: TaskSummary[] = [];
  const completed: TaskSummary[] = [];

  for (const task of tasks) {
    const normalized = task.status.trim().toLowerCase();

    if (normalized === "completed") {
      completed.push(task);
      continue;
    }

    if (normalized === "blocked" || normalized === "on_hold") {
      blocked.push(task);
      continue;
    }

    if (normalized === "in_progress") {
      inProgress.push(task);
      continue;
    }

    planned.push(task);
  }

  return { planned, inProgress, blocked, completed };
}

function badgeTone(tone: "neutral" | "info" | "warning" | "success") {
  if (tone === "success") {
    return "success" as const;
  }

  if (tone === "warning") {
    return "warning" as const;
  }

  if (tone === "info") {
    return "info" as const;
  }

  return "neutral" as const;
}
