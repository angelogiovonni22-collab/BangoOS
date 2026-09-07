"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, ClipboardCheck, Gauge, ShieldCheck, Users } from "lucide-react";
import { Badge, Button, getButtonClassName } from "@/components/ui";
import { calculateProjectCloseoutReadiness, type ProjectCloseoutNextAction } from "@/lib/projects/project-closeout-readiness";
import { useI18n } from "@/lib/i18n/provider";
import { ProjectBudgetControlDetails, ProjectCrewControlDetails } from "./project-control-card-details";
import styles from "./project-command-center-foundation.module.css";

type TaskSummary = { id: string; title: string; status: string; planned_finish: string | null };
type ControlKey = "budget" | "crew" | "schedule" | "progress";
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
  const { locale } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
  const [activeControl, setActiveControl] = useState<ControlKey | null>(null);
  const completed = props.tasks.filter((task) => status(task.status) === "completed");
  const active = props.tasks.filter((task) => ["in_progress", "blocked"].includes(status(task.status)));
  const progress = props.tasks.length ? Math.round((completed.length / props.tasks.length) * 100) : 0;
  const priorities = prioritizeTasks(props.tasks);
  const week = upcomingTasks(props.tasks);
  const blocked = active.some((task) => status(task.status) === "blocked");
  const healthAtRisk = props.openPermitsCount > 0 || props.pendingInspectionsCount > 0 || blocked;
  const phases = buildScopePhases(props.tasks, es);
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
  const closeoutAction = getCloseoutAction(projectHref, closeoutReadiness.nextAction, es);
  const toggleControl = (control: ControlKey) => setActiveControl((current) => current === control ? null : control);

  return (
    <div className={`space-y-4 ${styles.detailsFirst}`} data-project-overview="header-jobsite-clean">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={l("Project controls: Budget, Crew, Schedule, Progress", "Controles del proyecto: presupuesto, cuadrilla, calendario y progreso")}>
        <Metric control="budget" onClick={() => toggleControl("budget")} active={activeControl === "budget"} icon={<CircleDollarSign size={20} />} label={l("Budget", "Presupuesto")} value={props.budgetLabel} detail={`${l("Spent", "Gastado")} ${props.spentLabel}`} />
        <Metric control="crew" onClick={() => toggleControl("crew")} active={activeControl === "crew"} icon={<Users size={20} />} label={l("Crew", "Cuadrilla")} value={props.crewCount ? `${props.crewCount} ${l("assigned", "asignados")}` : l("Not assigned", "Sin asignar")} detail={`${active.length} ${l("active tasks", "tareas activas")}`} />
        <Metric control="schedule" onClick={() => toggleControl("schedule")} active={activeControl === "schedule"} icon={<CalendarDays size={20} />} label={l("Schedule", "Calendario")} value={daysRemainingLabel(props.targetDate, es)} detail={`${l("Target", "Objetivo")} ${props.targetDate}`} />
        <Metric control="progress" onClick={() => toggleControl("progress")} active={activeControl === "progress"} icon={<Gauge size={20} />} label={l("Progress", "Progreso")} value={`${progress}%`} detail={`${completed.length} ${l("of", "de")} ${props.tasks.length} ${l("tasks complete", "tareas completadas")}`} progress={progress} />
      </section>

      {activeControl ? (
        <section id={`project-control-${activeControl}`} data-project-control-expanded={activeControl} className="rounded-[18px] border border-[var(--color-primary-200)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-medium)] sm:p-5" aria-live="polite">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--color-primary-700)]">{l("Project Control", "Control del proyecto")}</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-[-0.02em] text-[var(--bos-text-strong-on-light)]">{controlTitle(activeControl, es)}</h2>
              <p className="mt-1 text-sm font-medium text-[var(--bos-text-medium-on-light)]">{controlDescription(activeControl, es)}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setActiveControl(null)}>{l("Close", "Cerrar")}</Button>
          </div>

          {activeControl === "budget" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label={l("Budget", "Presupuesto")} value={props.budgetLabel} />
                <Info label={l("Spent", "Gastado")} value={props.spentLabel} />
                <Info label={l("Remaining", "Restante")} value={props.remainingLabel} />
              </div>
              <ProjectBudgetControlDetails projectId={props.projectId} />
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={projectHref + "?tab=financials"} className={getButtonClassName({ variant: "outline", size: "sm" })}>{l("View Full Financials", "Ver finanzas completas")}</Link>
                <Link href={projectHref + "?tab=change_orders"} className={getButtonClassName({ size: "sm" })}>{l("Change Orders", "Órdenes de cambio")}</Link>
              </div>
            </div>
          ) : null}

          {activeControl === "crew" ? (
            <div className="space-y-4">
              <ProjectCrewControlDetails projectId={props.projectId} />
              <div className="flex flex-wrap justify-end gap-2">
                <Link href="/crews" className={getButtonClassName({ variant: "outline", size: "sm" })}>{l("Open CrewOS", "Abrir CrewOS")}</Link>
                <Link href={crewCostHref} className={getButtonClassName({ size: "sm" })}>{l("Open Workforce Details", "Abrir detalles de personal")}</Link>
              </div>
            </div>
          ) : null}

          {activeControl === "schedule" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Info label={l("Project start", "Inicio del proyecto")} value={props.startDate} />
                <Info label={l("Target completion", "Finalización objetivo")} value={props.targetDate} />
                <Info label={l("Assigned crew", "Cuadrilla asignada")} value={props.crewCount ? `${props.crewCount} ${l("assigned", "asignados")}` : l("Not assigned", "Sin asignar")} />
                <Info label={l("Schedule status", "Estado del calendario")} value={daysRemainingLabel(props.targetDate, es)} />
              </div>
              <div className="rounded-[14px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-extrabold text-[var(--bos-text-strong-on-light)]">{l("Next 7 Days", "Próximos 7 días")}</h3>
                  <Badge tone={week.length ? "info" : "neutral"}>{week.length} {l("scheduled", "programadas")}</Badge>
                </div>
                <div className="mt-3 divide-y divide-[var(--bos-border-light)]">
                  {week.length ? week.map((task) => (
                    <div key={task.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 py-2.5">
                      <p className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{formatTaskDate(task.planned_finish, es)}</p>
                      <p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{task.title}</p>
                      <Badge tone={status(task.status) === "completed" ? "success" : "info"}>{pretty(task.status, es)}</Badge>
                    </div>
                  )) : <Empty label={l("No tasks are scheduled in the next seven days.", "No hay tareas programadas en los próximos siete días.")} />}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={projectHref + "?tab=tasks"} className={getButtonClassName({ variant: "outline", size: "sm" })}>{l("Project Tasks", "Tareas del proyecto")}</Link>
                <Link href={scheduleHref} className={getButtonClassName({ size: "sm" })}>{l("Open Full Schedule", "Abrir calendario completo")}</Link>
              </div>
            </div>
          ) : null}

          {activeControl === "progress" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Info label={l("Overall progress", "Progreso general")} value={`${progress}%`} />
                <Info label={l("Completed tasks", "Tareas completadas")} value={`${completed.length} ${l("of", "de")} ${props.tasks.length}`} />
                <Info label={l("Active tasks", "Tareas activas")} value={String(active.length)} />
                <Info label={l("Blocked", "Bloqueadas")} value={String(active.filter((task) => status(task.status) === "blocked").length)} />
              </div>
              <div className="rounded-[14px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-4">
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-neutral-200)]">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary-600),var(--color-info-500))]" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-4 divide-y divide-[var(--bos-border-light)] rounded-[12px] border border-[var(--bos-border-light)] bg-white">
                  {phases.map((phase, index) => (
                    <div key={phase.id} className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
                      <span className={phaseDotClass(phase.state)}>{phase.state === "completed" ? <CheckCircle2 size={15} /> : index + 1}</span>
                      <p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{phase.title}</p>
                      <Badge tone={phase.state === "completed" ? "success" : phase.state === "in_progress" ? "info" : "neutral"}>{phaseLabel(phase.state, es)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={projectHref + "?tab=tasks"} className={getButtonClassName({ variant: "outline", size: "sm" })}>{l("View Full Progress", "Ver progreso completo")}</Link>
                <Link href={projectHref + "?tab=tasks"} className={getButtonClassName({ size: "sm" })}>{l("Update Progress", "Actualizar progreso")}</Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4">
        <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[var(--orion-blue)]">
                <ClipboardCheck size={19} aria-hidden="true" />
                <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[var(--bos-text-strong-on-light)]">{l("Scope of Work", "Alcance del trabajo")}</h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-[var(--bos-text-medium-on-light)]">
                {props.projectDescription?.trim() || l("The detailed scope for this project has not been entered yet.", "Aún no se ha ingresado el alcance detallado de este proyecto.")}
              </p>
            </div>
            <Badge tone={progress === 100 ? "success" : "info"}>{progress}% {l("complete", "completo")}</Badge>
          </div>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--color-neutral-200)]">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary-600),var(--color-info-500))]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 divide-y divide-[var(--bos-border-light)] rounded-[13px] border border-[var(--bos-border-light)]">
            {phases.map((phase, index) => (
              <div key={phase.id} className="grid min-w-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2.5">
                <span className={phaseDotClass(phase.state)}>{phase.state === "completed" ? <CheckCircle2 size={15} /> : index + 1}</span>
                <p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{phase.title}</p>
                <Badge tone={phase.state === "completed" ? "success" : phase.state === "in_progress" ? "info" : "neutral"}>{phaseLabel(phase.state, es)}</Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Link href={projectHref + "/edit#project-scope"} className={getButtonClassName({ variant: "outline", size: "sm" })}>{l("Edit Scope", "Editar alcance")}</Link>
            <Link href={projectHref + "?tab=tasks"} className={getButtonClassName({ variant: "outline", size: "sm" })}>{l("View Full Scope", "Ver alcance completo")}</Link>
            <Link href={projectHref + "?tab=tasks"} className={getButtonClassName({ size: "sm" })}>{l("Update Progress", "Actualizar progreso")}</Link>
          </div>
        </section>

        <div className="grid gap-4">
          <Card title={l("Today's Priorities", "Prioridades de hoy")} icon={<Activity size={18} />} action={<Link href={projectHref + "?tab=tasks"} className="text-xs font-bold text-[var(--orion-blue)]">{l("View all", "Ver todas")}</Link>}>
            <div className="divide-y divide-[var(--bos-border-light)]">
              {priorities.length ? priorities.map((task, index) => (
                <div key={task.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-extrabold text-[var(--color-primary-700)]">{index + 1}</span>
                  <p className="min-w-0 truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{task.title}</p>
                  <span className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{formatDue(task.planned_finish, es)}</span>
                </div>
              )) : <Empty label={l("No priority tasks are scheduled.", "No hay tareas prioritarias programadas.")} />}
            </div>
          </Card>
          <Card title={l("Project Health", "Salud del proyecto")} icon={<ShieldCheck size={18} />} action={<Badge tone={healthAtRisk ? "warning" : "success"}>{healthAtRisk ? l("Needs attention", "Requiere atención") : l("On track", "En curso")}</Badge>}>
            <div className="grid grid-cols-3 gap-2">
              <Health label={l("Schedule", "Calendario")} value={blocked ? l("Blocked", "Bloqueado") : l("On track", "En curso")} warning={blocked} />
              <Health label={l("Permits", "Permisos")} value={props.openPermitsCount ? `${props.openPermitsCount} ${l("open", "abiertos")}` : l("Clear", "Sin pendientes")} warning={props.openPermitsCount > 0} />
              <Health label={l("Safety", "Seguridad")} value={l("No incidents", "Sin incidentes")} />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card title={l("Next 7 Days", "Próximos 7 días")} icon={<CalendarDays size={18} />} action={<Link href={scheduleHref} className="text-xs font-bold text-[var(--orion-blue)]">{l("View schedule", "Ver calendario")}</Link>}>
          <div className="divide-y divide-[var(--bos-border-light)]">
            {week.length ? week.map((task) => (
              <div key={task.id} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 py-2.5">
                <p className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{formatTaskDate(task.planned_finish, es)}</p>
                <p className="truncate text-sm font-bold text-[var(--bos-text-strong-on-light)]">{task.title}</p>
                <Badge tone={status(task.status) === "completed" ? "success" : "info"}>{pretty(task.status, es)}</Badge>
              </div>
            )) : <Empty label={l("No tasks are scheduled in the next seven days.", "No hay tareas programadas en los próximos siete días.")} />}
          </div>
        </Card>
      </div>

      <section className="min-w-0 rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)] sm:p-5" data-testid="project-closeout-readiness">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--orion-blue)]">
              <CheckCircle2 size={18} aria-hidden="true" />
              <h2 className="text-lg font-extrabold text-[var(--bos-text-strong-on-light)]">{l("Closeout Readiness", "Preparación para cierre")}</h2>
            </div>
            <p className="mt-1 break-words text-xs font-medium text-[var(--bos-text-medium-on-light)]">{l("Live handover readiness from project completion, punch items, inspections, permits, and the closeout workflow.", "Preparación en vivo para la entrega según la finalización del proyecto, pendientes, inspecciones, permisos y flujo de cierre.")}</p>
          </div>
          <Badge tone={closeoutReadiness.status === "Ready" ? "success" : closeoutReadiness.status === "Blocked" ? "danger" : closeoutReadiness.status === "In progress" ? "warning" : "neutral"}>
            {closeoutReadiness.score}/100 · {localizeCloseoutStatus(closeoutReadiness.status, es)}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Health label={l("Project work", "Trabajo del proyecto")} value={progress === 100 ? l("Complete", "Completo") : `${progress}% ${l("complete", "completo")}`} warning={progress < 100} />
          <Health label={l("Punch items", "Pendientes")} value={props.openPunchItemsCount ? `${props.openPunchItemsCount} ${l("open", "abiertos")}` : l("Clear", "Sin pendientes")} warning={props.openPunchItemsCount > 0} />
          <Health label={l("Inspections", "Inspecciones")} value={props.pendingInspectionsCount ? `${props.pendingInspectionsCount} ${l("pending", "pendientes")}` : l("Clear", "Sin pendientes")} warning={props.pendingInspectionsCount > 0} />
          <Health label={l("Permits", "Permisos")} value={props.openPermitsCount ? `${props.openPermitsCount} ${l("open", "abiertos")}` : l("Clear", "Sin pendientes")} warning={props.openPermitsCount > 0} />
        </div>
        <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{l("Next closeout action", "Siguiente acción de cierre")}</p>
            <p className="mt-1 break-words text-sm font-extrabold text-[var(--bos-text-strong-on-light)]">{closeoutAction.label}</p>
            <p className="mt-1 break-words text-xs font-medium text-[var(--bos-text-medium-on-light)]">{closeoutAction.note} {l("Current workflow", "Flujo actual")}: {props.closeoutStatusLabel}.</p>
          </div>
          <Link href={closeoutAction.href} className="inline-flex shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-primary-300)] bg-white px-3 py-2 text-xs font-extrabold text-[var(--color-primary-700)] transition hover:bg-[var(--color-primary-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]">{l("Open closeout", "Abrir cierre")}</Link>
        </div>
      </section>

    </div>
  );
}

function Metric({ control, onClick, active, icon, label, value, detail, progress }: { control: ControlKey; onClick: () => void; active: boolean; icon: React.ReactNode; label: string; value: string; detail: string; progress?: number }) { return <button type="button" onClick={onClick} aria-expanded={active} aria-controls={`project-control-${control}`} className={`group w-full rounded-[16px] border bg-[var(--bos-bg-workspace-surface)] p-4 text-left shadow-[var(--shadow-small)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary-300)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)] ${active ? "border-[var(--color-primary-400)] ring-2 ring-[var(--color-primary-100)]" : "border-[var(--bos-border-light)]"}`}><div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">{icon}</span><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.1em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="truncate text-xl font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p></div><ChevronDown size={16} className={`ml-auto text-[var(--bos-text-medium-on-light)] transition ${active ? "rotate-180" : "-rotate-90 group-hover:translate-x-0.5"}`} /></div><p className="mt-2 truncate text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{detail}</p>{typeof progress === "number" ? <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-200)]"><div className="h-full bg-[var(--color-primary-600)]" style={{ width: `${progress}%` }} /></div> : null}</button>; }
function Card({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)]"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-[var(--orion-blue)]">{icon}<h2 className="text-lg font-extrabold text-[var(--bos-text-strong-on-light)]">{title}</h2></div>{action}</div>{children}</section>; }
function Health({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) { return <div className="min-w-0 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className={warning ? "mt-1 break-words text-xs font-extrabold text-[var(--color-warning-700)]" : "mt-1 break-words text-xs font-extrabold text-[var(--color-success-700)]"}>{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 truncate text-sm font-extrabold text-[var(--bos-text-strong-on-light)]" title={value}>{value}</p></div>; }
function Empty({ label }: { label: string }) { return <p className="py-4 text-sm font-medium text-[var(--bos-text-medium-on-light)]">{label}</p>; }
function status(value: string) { return value.trim().toLowerCase().replaceAll(" ", "_"); }
function pretty(value: string, es: boolean) { const normalized = status(value); if (es) { const labels: Record<string,string> = { completed: "Completada", in_progress: "En progreso", blocked: "Bloqueada", pending: "Pendiente", todo: "Pendiente", not_started: "No iniciada" }; if (labels[normalized]) return labels[normalized]; } return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function prioritizeTasks(tasks: TaskSummary[]) { return [...tasks].filter((task) => status(task.status) !== "completed").sort((a, b) => (a.planned_finish || "9999").localeCompare(b.planned_finish || "9999")).slice(0, 3); }
function upcomingTasks(tasks: TaskSummary[]) { const now = new Date(); const end = new Date(now); end.setDate(end.getDate() + 7); return [...tasks].filter((task) => { if (!task.planned_finish) return false; const date = new Date(task.planned_finish + "T12:00:00"); return date >= new Date(now.toDateString()) && date <= end; }).sort((a, b) => (a.planned_finish || "").localeCompare(b.planned_finish || "")).slice(0, 4); }
function formatTaskDate(value: string | null, es: boolean) { return value ? new Intl.DateTimeFormat(es ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(value + "T12:00:00")) : (es ? "Sin programar" : "Unscheduled"); }
function formatDue(value: string | null, es: boolean) { if (!value) return es ? "Sin fecha" : "No date"; return value === new Date().toISOString().slice(0, 10) ? (es ? "Hoy" : "Today") : formatTaskDate(value, es); }
function daysRemainingLabel(value: string, es: boolean) { const target = new Date(value); if (Number.isNaN(target.getTime())) return es ? "Sin programar" : "Not scheduled"; const days = Math.ceil((target.getTime() - Date.now()) / 86400000); return days < 0 ? `${Math.abs(days)} ${es ? "días de retraso" : "days overdue"}` : `${days} ${es ? "días restantes" : "days left"}`; }
function buildScopePhases(tasks: TaskSummary[], es: boolean) { if (!tasks.length) return [{ id: "scope", title: es ? "Detalles del alcance no ingresados" : "Scope details not entered", state: "upcoming" }]; return [...tasks].sort((a, b) => (a.planned_finish || "9999").localeCompare(b.planned_finish || "9999")).slice(0, 5).map((task) => ({ id: task.id, title: task.title, state: status(task.status) === "completed" ? "completed" : status(task.status) === "in_progress" ? "in_progress" : "upcoming" })); }
function phaseDotClass(state: string) { return state === "completed" ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success-100)] text-xs font-bold text-[var(--color-success-700)]" : state === "in_progress" ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-info-100)] text-xs font-bold text-[var(--color-info-700)]" : "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-neutral-100)] text-xs font-bold text-[var(--bos-text-medium-on-light)]"; }
function phaseLabel(state: string, es: boolean) { return state === "completed" ? (es ? "Completa" : "Complete") : state === "in_progress" ? (es ? "En progreso" : "In progress") : (es ? "Próxima" : "Upcoming"); }
function controlTitle(control: ControlKey, es: boolean) { if (control === "budget") return es ? "Presupuesto y compromisos" : "Budget & Commitments"; if (control === "crew") return es ? "Personal del proyecto" : "Project Workforce"; if (control === "schedule") return es ? "Calendario del proyecto" : "Project Schedule"; return es ? "Progreso del proyecto" : "Project Progress"; }
function controlDescription(control: ControlKey, es: boolean) { if (control === "budget") return es ? "Presupuesto en vivo, gasto real, compromisos laborales, obligaciones de subcontratos firmados y dólares restantes." : "Live budget, actual spend, labor commitments, signed subcontract obligations, and remaining dollars."; if (control === "crew") return es ? "Empleados y cuadrillas primero, seguidos de totales laborales y acuerdos de compensación de subcontratistas." : "Employees and crews first, followed by labor totals and subcontractor compensation agreements."; if (control === "schedule") return es ? "Fechas del proyecto, personal asignado, trabajo próximo y los siguientes siete días de un vistazo." : "Project dates, assigned workforce, upcoming work, and the next seven days at a glance."; return es ? "Finalización general, trabajo activo y bloqueado, fases y tareas que impulsan el progreso del proyecto." : "Overall completion, active and blocked work, phases, and the tasks driving project progress."; }
function localizeCloseoutStatus(value: string, es: boolean) { if (!es) return value; const labels: Record<string,string> = { Ready: "Listo", Blocked: "Bloqueado", "In progress": "En progreso", "Not started": "No iniciado" }; return labels[value] || value; }
function getCloseoutAction(projectHref: string, nextAction: ProjectCloseoutNextAction, es: boolean) { if (nextAction === "start_closeout") return { label: es ? "Iniciar cierre del proyecto" : "Start project closeout", note: es ? "Abre el flujo de cumplimiento e inicia la lista de cierre." : "Open the compliance workflow and initialize the closeout checklist.", href: projectHref + "?tab=inspections" }; if (nextAction === "punch_items") return { label: es ? "Resolver pendientes abiertos" : "Clear open punch items", note: es ? "Resuelve los pendientes antes de avanzar la entrega." : "Resolve punch work before handover can advance.", href: projectHref + "?tab=inspections#punch-list" }; if (nextAction === "inspections") return { label: es ? "Completar inspecciones pendientes" : "Complete pending inspections", note: es ? "Finaliza las inspecciones requeridas y registra los resultados finales." : "Finish required inspections and record final results.", href: projectHref + "?tab=inspections" }; if (nextAction === "permits") return { label: es ? "Cerrar permisos abiertos" : "Close open permits", note: es ? "Resuelve los elementos pendientes del ciclo de permisos antes de la entrega." : "Resolve outstanding permit lifecycle items before handover.", href: projectHref + "?tab=inspections" }; if (nextAction === "finish_work") return { label: es ? "Finalizar trabajo del proyecto" : "Finish project work", note: es ? "Completa las tareas restantes antes del cierre final." : "Complete remaining project tasks before final closeout.", href: projectHref + "?tab=tasks" }; if (nextAction === "closeout_checklist") return { label: es ? "Completar lista de cierre" : "Complete closeout checklist", note: es ? "Finaliza pago, aprobación del cliente, documentos, cuadrilla y requisitos de entrega de equipo." : "Finish payment, customer approval, documents, crew, and equipment handover requirements.", href: projectHref + "?tab=inspections" }; return { label: es ? "Completar entrega del proyecto" : "Complete project handover", note: es ? "Las señales de cierre están claras y el proyecto está listo para finalización." : "Closeout signals are clear and the project is ready for final completion.", href: projectHref + "?tab=inspections" }; }
