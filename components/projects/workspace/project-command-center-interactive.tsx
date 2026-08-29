"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, Gauge, Users } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { ProjectBudgetControlDetails, ProjectCrewControlDetails } from "./project-control-card-details";
import { ProjectCommandCenterFoundation as BaseProjectCommandCenterFoundation } from "./project-command-center-foundation";
import foundationStyles from "./project-command-center-foundation.module.css";
import styles from "./project-command-center-interactive.module.css";

type Props = ComponentProps<typeof BaseProjectCommandCenterFoundation>;
type TaskSummary = Props["tasks"][number];
type ControlKey = "budget" | "crew" | "schedule" | "progress";

export function ProjectCommandCenterFoundation(props: Props) {
  const searchParams = useSearchParams();
  const activeControl = parseControlKey(searchParams.get("control"));
  const completed = props.tasks.filter((task) => status(task.status) === "completed");
  const active = props.tasks.filter((task) => ["in_progress", "blocked"].includes(status(task.status)));
  const progress = props.tasks.length ? Math.round((completed.length / props.tasks.length) * 100) : 0;
  const week = upcomingTasks(props.tasks);
  const phases = buildScopePhases(props.tasks);
  const projectHref = "/projects/" + props.projectId;
  const scheduleHref = `/schedule?project=${encodeURIComponent(props.projectId)}`;
  const crewCostHref = `${projectHref}/crew-costs`;

  return (
    <div className={`space-y-4 ${foundationStyles.detailsFirst}`} data-project-control-wrapper="navigation-backed">
      <section id="project-controls" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Project controls: Budget, Crew, Schedule, Progress">
        <Metric control="budget" projectHref={projectHref} active={activeControl === "budget"} icon={<CircleDollarSign size={20} />} label="Budget" value={props.budgetLabel} detail={"Spent " + props.spentLabel} />
        <Metric control="crew" projectHref={projectHref} active={activeControl === "crew"} icon={<Users size={20} />} label="Crew" value={props.crewCount ? props.crewCount + " assigned" : "Not assigned"} detail={active.length + " active tasks"} />
        <Metric control="schedule" projectHref={projectHref} active={activeControl === "schedule"} icon={<CalendarDays size={20} />} label="Schedule" value={daysRemainingLabel(props.targetDate)} detail={"Target " + props.targetDate} />
        <Metric control="progress" projectHref={projectHref} active={activeControl === "progress"} icon={<Gauge size={20} />} label="Progress" value={progress + "%"} detail={completed.length + " of " + props.tasks.length + " tasks complete"} progress={progress} />
      </section>

      {activeControl ? (
        <section id={`project-control-${activeControl}`} data-project-control-expanded={activeControl} className="rounded-[18px] border border-[var(--color-primary-200)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-medium)] sm:p-5" aria-live="polite">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--color-primary-700)]">Project Control</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[var(--bos-text-strong-on-light)]">{controlTitle(activeControl)}</h2>
              <p className="mt-1 text-sm font-medium text-[var(--bos-text-medium-on-light)]">{controlDescription(activeControl)}</p>
            </div>
            <a href={`${projectHref}#project-controls`} className="inline-flex h-8 items-center justify-center rounded-[9px] border border-[var(--bos-border-light)] bg-white px-3 text-xs font-extrabold text-[var(--bos-text-strong-on-light)] transition hover:bg-[var(--color-neutral-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]">Close</a>
          </div>

          {activeControl === "budget" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Budget" value={props.budgetLabel} />
                <Info label="Spent" value={props.spentLabel} />
                <Info label="Remaining" value={props.remainingLabel} />
              </div>
              <ProjectBudgetControlDetails projectId={props.projectId} />
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={projectHref + "?tab=financials"}><Button variant="outline" size="sm">View Full Financials</Button></Link>
                <Link href={projectHref + "?tab=change_orders"}><Button size="sm">Change Orders</Button></Link>
              </div>
            </div>
          ) : null}

          {activeControl === "crew" ? (
            <div className="space-y-4">
              <ProjectCrewControlDetails projectId={props.projectId} />
              <div className="flex flex-wrap justify-end gap-2">
                <Link href="/crews"><Button variant="outline" size="sm">Open CrewOS</Button></Link>
                <Link href={crewCostHref}><Button size="sm">Open Workforce Details</Button></Link>
              </div>
            </div>
          ) : null}

          {activeControl === "schedule" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Info label="Project start" value={props.startDate} />
                <Info label="Target completion" value={props.targetDate} />
                <Info label="Assigned crew" value={props.crewCount ? props.crewCount + " assigned" : "Not assigned"} />
                <Info label="Schedule status" value={daysRemainingLabel(props.targetDate)} />
              </div>
              <div className="rounded-[14px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-extrabold text-[var(--bos-text-strong-on-light)]">Next 7 Days</h3>
                  <Badge tone={week.length ? "info" : "neutral"}>{week.length} scheduled</Badge>
                </div>
                <div className="mt-3 divide-y divide-[var(--bos-border-light)]">
                  {week.length ? week.map((task) => (
                    <div key={task.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 py-2.5">
                      <p className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{formatTaskDate(task.planned_finish)}</p>
                      <p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{task.title}</p>
                      <Badge tone={status(task.status) === "completed" ? "success" : "info"}>{pretty(task.status)}</Badge>
                    </div>
                  )) : <Empty label="No tasks are scheduled in the next seven days." />}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={projectHref + "?tab=tasks"}><Button variant="outline" size="sm">Project Tasks</Button></Link>
                <Link href={scheduleHref}><Button size="sm">Open Full Schedule</Button></Link>
              </div>
            </div>
          ) : null}

          {activeControl === "progress" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Info label="Overall progress" value={progress + "%"} />
                <Info label="Completed tasks" value={`${completed.length} of ${props.tasks.length}`} />
                <Info label="Active tasks" value={String(active.length)} />
                <Info label="Blocked" value={String(active.filter((task) => status(task.status) === "blocked").length)} />
              </div>
              <div className="rounded-[14px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-4">
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-neutral-200)]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary-600),var(--color-info-500))]" style={{ width: progress + "%" }} />
                </div>
                <div className="mt-4 divide-y divide-[var(--bos-border-light)] rounded-[12px] border border-[var(--bos-border-light)] bg-white">
                  {phases.map((phase, index) => (
                    <div key={phase.id} className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
                      <span className={phaseDotClass(phase.state)}>{phase.state === "completed" ? <CheckCircle2 size={15} /> : index + 1}</span>
                      <p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{phase.title}</p>
                      <Badge tone={phase.state === "completed" ? "success" : phase.state === "in_progress" ? "info" : "neutral"}>{phaseLabel(phase.state)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={projectHref + "?tab=tasks"}><Button variant="outline" size="sm">View Full Progress</Button></Link>
                <Link href={projectHref + "?tab=tasks"}><Button size="sm">Update Progress</Button></Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className={styles.base}>
        <BaseProjectCommandCenterFoundation {...props} />
      </div>
    </div>
  );
}

function Metric({ control, projectHref, active, icon, label, value, detail, progress }: { control: ControlKey; projectHref: string; active: boolean; icon: ReactNode; label: string; value: string; detail: string; progress?: number }) {
  const action = active ? `${projectHref}#project-controls` : `${projectHref}#project-control-${control}`;
  return (
    <form action={action} method="get" className="w-full">
      <button type="submit" name={active ? undefined : "control"} value={active ? undefined : control} aria-expanded={active} aria-controls={`project-control-${control}`} className={`group w-full rounded-[16px] border bg-[var(--bos-bg-workspace-surface)] p-4 text-left shadow-[var(--shadow-small)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary-300)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] ${active ? "border-[var(--color-primary-400)] ring-2 ring-[var(--color-primary-100)]" : "border-[var(--bos-border-light)]"}`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">{icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--bos-text-medium-on-light)]">{label}</p>
            <p className="truncate text-xl font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p>
          </div>
          <ChevronDown size={16} className={`ml-auto text-[var(--bos-text-medium-on-light)] transition ${active ? "rotate-180" : "-rotate-90 group-hover:translate-x-0.5"}`} />
        </div>
        <p className="mt-2 truncate text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{detail}</p>
        {typeof progress === "number" ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-200)]"><div className="h-full bg-[var(--color-primary-600)]" style={{ width: progress + "%" }} /></div> : null}
      </button>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 truncate text-sm font-extrabold text-[var(--bos-text-strong-on-light)]" title={value}>{value}</p></div>; }
function Empty({ label }: { label: string }) { return <p className="py-4 text-sm font-medium text-[var(--bos-text-medium-on-light)]">{label}</p>; }
function status(value: string) { return value.trim().toLowerCase().replaceAll(" ", "_"); }
function pretty(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function upcomingTasks(tasks: TaskSummary[]) { const now = new Date(); const end = new Date(now); end.setDate(end.getDate() + 7); return [...tasks].filter((task) => { if (!task.planned_finish) return false; const date = new Date(task.planned_finish + "T12:00:00"); return date >= new Date(now.toDateString()) && date <= end; }).sort((a, b) => (a.planned_finish || "").localeCompare(b.planned_finish || "")).slice(0, 4); }
function formatTaskDate(value: string | null) { return value ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(value + "T12:00:00")) : "Unscheduled"; }
function daysRemainingLabel(value: string) { const target = new Date(value); if (Number.isNaN(target.getTime())) return "Not scheduled"; const days = Math.ceil((target.getTime() - Date.now()) / 86400000); return days < 0 ? Math.abs(days) + " days overdue" : days + " days left"; }
function buildScopePhases(tasks: TaskSummary[]) { if (!tasks.length) return [{ id: "scope", title: "Scope details not entered", state: "upcoming" }]; return [...tasks].sort((a, b) => (a.planned_finish || "9999").localeCompare(b.planned_finish || "9999")).slice(0, 5).map((task) => ({ id: task.id, title: task.title, state: status(task.status) === "completed" ? "completed" : status(task.status) === "in_progress" ? "in_progress" : "upcoming" })); }
function phaseDotClass(state: string) { return state === "completed" ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success-100)] text-xs font-bold text-[var(--color-success-700)]" : state === "in_progress" ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-info-100)] text-xs font-bold text-[var(--color-info-700)]" : "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-neutral-100)] text-xs font-bold text-[var(--bos-text-medium-on-light)]"; }
function phaseLabel(state: string) { return state === "completed" ? "Complete" : state === "in_progress" ? "In progress" : "Upcoming"; }
function controlTitle(control: ControlKey) { if (control === "budget") return "Budget & Commitments"; if (control === "crew") return "Project Workforce"; if (control === "schedule") return "Project Schedule"; return "Project Progress"; }
function controlDescription(control: ControlKey) { if (control === "budget") return "Live budget, actual spend, labor commitments, signed subcontract obligations, and remaining dollars."; if (control === "crew") return "Employees and crews first, followed by labor totals and subcontractor compensation agreements."; if (control === "schedule") return "Project dates, assigned workforce, upcoming work, and the next seven days at a glance."; return "Overall completion, active and blocked work, phases, and the tasks driving project progress."; }
function parseControlKey(value: string | null): ControlKey | null { return value === "budget" || value === "crew" || value === "schedule" || value === "progress" ? value : null; }
