import Link from "next/link";
import { Activity, CalendarDays, Camera, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardCheck, FileText, Gauge, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { calculateProjectCloseoutReadiness, type ProjectCloseoutNextAction } from "@/lib/projects/project-closeout-readiness";
import styles from "./project-command-center-foundation.module.css";

type TaskSummary = { id: string; title: string; status: string; planned_finish: string | null };
export type CommandCenterTimelineEntry = { id: string; title: string; detail: string; occurredAt: string; tone: "neutral" | "info" | "warning" | "success" };

type Props = {
  projectId: string; projectName: string; projectDescription: string | null; customerName: string;
  projectAddress: string; statusLabel: string; tasks: TaskSummary[]; budgetLabel: string;
  spentLabel: string; remainingLabel: string; startDate: string; targetDate: string; crewCount: number;
  estimatesCount: number; changeOrdersCount: number; invoicesCount: number; photosCount: number;
  permitsCount: number; inspectionsCount: number; dailyReportsCount: number; openPunchItemsCount: number;
  openPermitsCount: number; pendingInspectionsCount: number; closeoutStatusLabel: string; closeoutReady: boolean;
  activityItems: Array<{ id: string; title: string; detail: string; timestamp: string; tone: string }>;
  timelineEntries: CommandCenterTimelineEntry[];
};

export function ProjectCommandCenterFoundation(props: Props) {
  const completed = props.tasks.filter((task) => status(task.status) === "completed");
  const active = props.tasks.filter((task) => ["in_progress", "blocked"].includes(status(task.status)));
  const progress = props.tasks.length ? Math.round((completed.length / props.tasks.length) * 100) : 0;
  const priorities = prioritizeTasks(props.tasks);
  const week = upcomingTasks(props.tasks);
  const blocked = active.some((task) => status(task.status) === "blocked");
  const healthAtRisk = props.openPermitsCount > 0 || props.pendingInspectionsCount > 0 || blocked;
  const phases = buildScopePhases(props.tasks);
  const projectHref = "/projects/" + props.projectId;
  const scheduleHref = `/schedule?project=${encodeURIComponent(props.projectId)}`;
  const crewCostHref = `${projectHref}/crew-costs`;
  const closeoutStarted = props.closeoutStatusLabel.trim().toLowerCase() !== "not started";
  const closeoutReadiness = calculateProjectCloseoutReadiness({
    closeoutStarted,
    closeoutReady: props.closeoutReady,
    projectProgress: progress,
    openPunchItems: props.openPunchItemsCount,
    pendingInspections: props.pendingInspectionsCount,
    openPermits: props.openPermitsCount,
  });
  const closeoutAction = getCloseoutAction(projectHref, closeoutReadiness.nextAction);

  return (
    <div className={`space-y-4 ${styles.detailsFirst}`} data-project-overview="header-jobsite-clean">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Project controls: Budget, Crew, Schedule, Progress">
        <Metric href={projectHref + "?tab=financials"} icon={<CircleDollarSign size={20} />} label="Budget" value={props.budgetLabel} detail={"Spent " + props.spentLabel} />
        <Metric href={crewCostHref} icon={<Users size={20} />} label="Crew" value={props.crewCount ? props.crewCount + " assigned" : "Not assigned"} detail={active.length + " active tasks"} />
        <Metric href={scheduleHref} icon={<CalendarDays size={20} />} label="Schedule" value={daysRemainingLabel(props.targetDate)} detail={"Target " + props.targetDate} />
        <Metric href={projectHref + "?tab=tasks"} icon={<Gauge size={20} />} label="Progress" value={progress + "%"} detail={completed.length + " of " + props.tasks.length + " tasks complete"} progress={progress} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[var(--orion-blue)]">
                <ClipboardCheck size={19} aria-hidden="true" />
                <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[var(--bos-text-strong-on-light)]">Scope of Work</h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--bos-text-medium-on-light)]">
                {props.projectDescription?.trim() || "The detailed scope for this project has not been entered yet."}
              </p>
            </div>
            <Badge tone={progress === 100 ? "success" : "info"}>{progress}% complete</Badge>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--color-neutral-200)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary-600),var(--color-info-500))]" style={{ width: progress + "%" }} />
          </div>
          <div className="mt-4 divide-y divide-[var(--bos-border-light)] rounded-[13px] border border-[var(--bos-border-light)]">
            {phases.map((phase, index) => (
              <div key={phase.id} className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
                <span className={phaseDotClass(phase.state)}>{phase.state === "completed" ? <CheckCircle2 size={15} /> : index + 1}</span>
                <p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{phase.title}</p>
                <Badge tone={phase.state === "completed" ? "success" : phase.state === "in_progress" ? "info" : "neutral"}>{phaseLabel(phase.state)}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link href={projectHref + "/edit#project-scope"}><Button variant="outline" size="sm">Edit Scope</Button></Link>
            <Link href={projectHref + "?tab=tasks"}><Button variant="outline" size="sm">View Full Scope</Button></Link>
            <Link href={projectHref + "?tab=tasks"}><Button size="sm">Update Progress</Button></Link>
          </div>
        </section>

        <div className="grid gap-4">
          <Card title="Today's Priorities" icon={<Activity size={18} />} action={<Link href={projectHref + "?tab=tasks"} className="text-xs font-bold text-[var(--orion-blue)]">View all</Link>}>
            <div className="divide-y divide-[var(--bos-border-light)]">
              {priorities.length ? priorities.map((task, index) => (
                <div key={task.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-extrabold text-[var(--color-primary-700)]">{index + 1}</span>
                  <p className="min-w-0 truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{task.title}</p>
                  <span className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{formatDue(task.planned_finish)}</span>
                </div>
              )) : <Empty label="No priority tasks are scheduled." />}
            </div>
          </Card>
          <Card title="Project Health" icon={<ShieldCheck size={18} />} action={<Badge tone={healthAtRisk ? "warning" : "success"}>{healthAtRisk ? "Needs attention" : "On track"}</Badge>}>
            <div className="grid grid-cols-3 gap-2">
              <Health label="Schedule" value={blocked ? "Blocked" : "On track"} warning={blocked} />
              <Health label="Permits" value={props.openPermitsCount ? props.openPermitsCount + " open" : "Clear"} warning={props.openPermitsCount > 0} />
              <Health label="Safety" value="No incidents" />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card title="Next 7 Days" icon={<CalendarDays size={18} />} action={<Link href={scheduleHref} className="text-xs font-bold text-[var(--orion-blue)]">View schedule</Link>}>
          <div className="divide-y divide-[var(--bos-border-light)]">
            {week.length ? week.map((task) => (
              <div key={task.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 py-2.5">
                <p className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{formatTaskDate(task.planned_finish)}</p>
                <p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{task.title}</p>
                <Badge tone={status(task.status) === "completed" ? "success" : "info"}>{pretty(task.status)}</Badge>
              </div>
            )) : <Empty label="No tasks are scheduled in the next seven days." />}
          </div>
        </Card>
        <Card title="Project Team" icon={<Users size={18} />} action={<Link href={crewCostHref} className="text-xs font-bold text-[var(--orion-blue)]">View team</Link>}>
          <div className="grid gap-2 sm:grid-cols-3">
            <Info label="Customer" value={props.customerName} />
            <Info label="Assigned crew" value={props.crewCount ? props.crewCount + " members" : "Not assigned"} />
            <Info label="Project status" value={props.statusLabel} />
          </div>
        </Card>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Shortcut href={projectHref + "?tab=tasks"} icon={<TriangleAlert size={20} />} label="Open Issues" value={props.openPunchItemsCount} tone="danger" />
        <Shortcut href={projectHref + "?tab=change_orders"} icon={<FileText size={20} />} label="Change Orders" value={props.changeOrdersCount} tone="warning" />
        <Shortcut href={projectHref + "?tab=documents"} icon={<FileText size={20} />} label="Documents" value={props.dailyReportsCount + props.permitsCount + props.inspectionsCount} />
        <Shortcut href={projectHref + "?tab=photos"} icon={<Camera size={20} />} label="Photos" value={props.photosCount} />
      </section>

      <section className="min-w-0 rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)] sm:p-5" data-testid="project-closeout-readiness">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--orion-blue)]">
              <CheckCircle2 size={18} aria-hidden="true" />
              <h2 className="text-lg font-extrabold text-[var(--bos-text-strong-on-light)]">Closeout Readiness</h2>
            </div>
            <p className="mt-1 break-words text-xs font-medium text-[var(--bos-text-medium-on-light)]">Live handover readiness from project completion, punch items, inspections, permits, and the closeout workflow.</p>
          </div>
          <Badge tone={closeoutReadiness.status === "Ready" ? "success" : closeoutReadiness.status === "Blocked" ? "danger" : closeoutReadiness.status === "In progress" ? "warning" : "neutral"}>
            {closeoutReadiness.score}/100 · {closeoutReadiness.status}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Health label="Project work" value={progress === 100 ? "Complete" : progress + "% complete"} warning={progress < 100} />
          <Health label="Punch items" value={props.openPunchItemsCount ? props.openPunchItemsCount + " open" : "Clear"} warning={props.openPunchItemsCount > 0} />
          <Health label="Inspections" value={props.pendingInspectionsCount ? props.pendingInspectionsCount + " pending" : "Clear"} warning={props.pendingInspectionsCount > 0} />
          <Health label="Permits" value={props.openPermitsCount ? props.openPermitsCount + " open" : "Clear"} warning={props.openPermitsCount > 0} />
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">Next closeout action</p>
            <p className="mt-1 break-words text-sm font-extrabold text-[var(--bos-text-strong-on-light)]">{closeoutAction.label}</p>
            <p className="mt-1 break-words text-xs font-medium text-[var(--bos-text-medium-on-light)]">{closeoutAction.note} Current workflow: {props.closeoutStatusLabel}.</p>
          </div>
          <Link href={closeoutAction.href} className="inline-flex shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-primary-300)] bg-white px-3 py-2 text-xs font-extrabold text-[var(--color-primary-700)] transition hover:bg-[var(--color-primary-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]">Open closeout</Link>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Collapsible title="Financials" subtitle="Budget, costs, commitments and change orders"><div className="grid gap-3 sm:grid-cols-3"><Info label="Budget" value={props.budgetLabel} /><Info label="Spent" value={props.spentLabel} /><Info label="Remaining" value={props.remainingLabel} /></div></Collapsible>
        <Collapsible title="Documents & Activity" subtitle="Reports, records, communication and recent changes"><div className="grid gap-3"><Info label="Project records" value={props.dailyReportsCount + " reports · " + props.invoicesCount + " invoices · " + props.estimatesCount + " estimates"} /><Info label="Latest activity" value={props.activityItems[0]?.title || props.timelineEntries[0]?.title || "No activity recorded"} /></div></Collapsible>
      </div>
    </div>
  );
}

function Metric({ href, icon, label, value, detail, progress }: { href: string; icon: React.ReactNode; label: string; value: string; detail: string; progress?: number }) { return <Link href={href} className="group rounded-[16px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary-300)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]"><div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">{icon}</span><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="truncate text-xl font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p></div><ChevronDown size={16} className="ml-auto -rotate-90 text-[var(--bos-text-medium-on-light)] transition group-hover:translate-x-0.5" /></div><p className="mt-2 truncate text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{detail}</p>{typeof progress === "number" ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-200)]"><div className="h-full bg-[var(--color-primary-600)]" style={{ width: progress + "%" }} /></div> : null}</Link>; }
function Card({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)]"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[var(--orion-blue)]">{icon}<h2 className="text-lg font-extrabold text-[var(--bos-text-strong-on-light)]">{title}</h2></div>{action}</div>{children}</section>; }
function Health({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="min-w-0 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className={warning ? "mt-1 break-words text-xs font-extrabold text-[var(--color-warning-700)]" : "mt-1 break-words text-xs font-extrabold text-[var(--color-success-700)]"}>{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 truncate text-sm font-extrabold text-[var(--bos-text-strong-on-light)]" title={value}>{value}</p></div>; }
function Shortcut({ href, icon, label, value, tone }: { href: string; icon: React.ReactNode; label: string; value: number; tone?: "danger" | "warning" }) { const color = tone === "danger" ? "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]" : tone === "warning" ? "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]" : "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]"; return <Link href={href} className="group flex items-center gap-3 rounded-[15px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-3.5 shadow-[var(--shadow-small)] transition hover:-translate-y-0.5"><span className={"inline-flex h-10 w-10 items-center justify-center rounded-full " + color}>{icon}</span><div><p className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{label}</p><p className="text-xl font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p></div><ChevronDown size={16} className="ml-auto -rotate-90 text-[var(--bos-text-medium-on-light)]" /></Link>; }
function Collapsible({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <details className="group rounded-[15px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] shadow-[var(--shadow-small)]"><summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5"><span className="text-[var(--orion-blue)]"><FileText size={17} /></span><div className="min-w-0"><p className="font-extrabold text-[var(--bos-text-strong-on-light)]">{title}</p><p className="truncate text-xs font-medium text-[var(--bos-text-medium-on-light)]">{subtitle}</p></div><ChevronDown size={17} className="ml-auto shrink-0 text-[var(--bos-text-medium-on-light)] transition group-open:rotate-180" /></summary><div className="border-t border-[var(--bos-border-light)] p-4">{children}</div></details>; }
function Empty({ label }: { label: string }) { return <p className="py-4 text-sm font-medium text-[var(--bos-text-medium-on-light)]">{label}</p>; }
function status(value: string) { return value.trim().toLowerCase().replaceAll(" ", "_"); }
function pretty(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function prioritizeTasks(tasks: TaskSummary[]) { return [...tasks].filter((task) => status(task.status) !== "completed").sort((a, b) => (a.planned_finish || "9999").localeCompare(b.planned_finish || "9999")).slice(0, 3); }
function upcomingTasks(tasks: TaskSummary[]) { const now = new Date(); const end = new Date(now); end.setDate(end.getDate() + 7); return [...tasks].filter((task) => { if (!task.planned_finish) return false; const date = new Date(task.planned_finish + "T12:00:00"); return date >= new Date(now.toDateString()) && date <= end; }).sort((a, b) => (a.planned_finish || "").localeCompare(b.planned_finish || "")).slice(0, 4); }
function formatTaskDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(value + "T12:00:00")) : "Unscheduled"; }
function formatDue(value: string | null) { if (!value) return "No date"; return value === new Date().toISOString().slice(0, 10) ? "Today" : formatTaskDate(value); }
function daysRemainingLabel(value: string) { const target = new Date(value); if (Number.isNaN(target.getTime())) return "Not scheduled"; const days = Math.ceil((target.getTime() - Date.now()) / 86400000); return days < 0 ? Math.abs(days) + " days overdue" : days + " days left"; }
function buildScopePhases(tasks: TaskSummary[]) { if (!tasks.length) return [{ id: "scope", title: "Scope details not entered", state: "upcoming" }]; return [...tasks].sort((a, b) => (a.planned_finish || "9999").localeCompare(b.planned_finish || "9999")).slice(0, 5).map((task) => ({ id: task.id, title: task.title, state: status(task.status) === "completed" ? "completed" : status(task.status) === "in_progress" ? "in_progress" : "upcoming" })); }
function phaseDotClass(state: string) { return state === "completed" ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success-100)] text-xs font-bold text-[var(--color-success-700)]" : state === "in_progress" ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-info-100)] text-xs font-bold text-[var(--color-info-700)]" : "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-neutral-100)] text-xs font-bold text-[var(--bos-text-medium-on-light)]"; }
function phaseLabel(state: string) { return state === "completed" ? "Complete" : state === "in_progress" ? "In progress" : "Upcoming"; }
function getCloseoutAction(projectHref: string, nextAction: ProjectCloseoutNextAction) { if (nextAction === "start_closeout") return { label: "Start project closeout", note: "Open the compliance workflow and initialize the closeout checklist.", href: projectHref + "?tab=inspections" }; if (nextAction === "punch_items") return { label: "Clear open punch items", note: "Resolve punch work before handover can advance.", href: projectHref + "?tab=inspections#punch-list" }; if (nextAction === "inspections") return { label: "Complete pending inspections", note: "Finish required inspections and record final results.", href: projectHref + "?tab=inspections" }; if (nextAction === "permits") return { label: "Close open permits", note: "Resolve outstanding permit lifecycle items before handover.", href: projectHref + "?tab=inspections" }; if (nextAction === "finish_work") return { label: "Finish project work", note: "Complete remaining project tasks before final closeout.", href: projectHref + "?tab=tasks" }; if (nextAction === "closeout_checklist") return { label: "Complete closeout checklist", note: "Finish payment, customer approval, documents, crew, and equipment handover requirements.", href: projectHref + "?tab=inspections" }; return { label: "Complete project handover", note: "Closeout signals are clear and the project is ready for final completion.", href: projectHref + "?tab=inspections" }; }
