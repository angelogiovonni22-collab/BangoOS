"use client";

import Link from "next/link";
import { Activity, AlertTriangle, CalendarDays, CircleDollarSign, ClipboardList, HardHat, MapPin, ShieldCheck, Users } from "lucide-react";
import { Badge, getButtonClassName } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import styles from "./project-command-center-foundation.module.css";

type TaskSummary = { id: string; title: string; status: string; planned_finish: string | null };
export type CommandCenterTimelineEntry = { id: string; title: string; detail: string; occurredAt: string; tone: "neutral" | "info" | "warning" | "success" };

type Props = {
  projectId: string; projectName: string; projectDescription: string | null; customerName: string;
  projectAddress: string; statusLabel: string; projectStatus: string; tasks: TaskSummary[]; budgetLabel: string;
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
  const projectHref = "/projects/" + props.projectId;
  const completedTasks = props.tasks.filter((task) => normalize(task.status) === "completed");
  const activeTasks = props.tasks.filter((task) => ["in_progress", "blocked"].includes(normalize(task.status)));
  const blockedTasks = activeTasks.filter((task) => normalize(task.status) === "blocked");
  const progress = normalize(props.projectStatus) === "completed" ? 100 : props.tasks.length ? Math.round((completedTasks.length / props.tasks.length) * 100) : 0;
  const upcoming = [...props.tasks].filter((task) => normalize(task.status) !== "completed").sort((a, b) => (a.planned_finish || "9999").localeCompare(b.planned_finish || "9999")).slice(0, 4);
  const risks = [
    props.crewCount === 0 ? { label: l("No B.O.S. crew assigned", "No hay cuadrilla B.O.S. asignada"), detail: l("Assign internal workforce if Bango employees will perform project work.", "Asigna personal interno si empleados de Bango realizarán trabajo del proyecto."), tone: "warning" as const } : null,
    props.openPermitsCount > 0 ? { label: l("Open permit items", "Permisos abiertos"), detail: String(props.openPermitsCount) + " " + l("permit item(s) need attention.", "elemento(s) de permiso requieren atención."), tone: "warning" as const } : null,
    props.pendingInspectionsCount > 0 ? { label: l("Pending inspections", "Inspecciones pendientes"), detail: String(props.pendingInspectionsCount) + " " + l("inspection(s) remain open.", "inspección(es) siguen abiertas."), tone: "warning" as const } : null,
    blockedTasks.length > 0 ? { label: l("Blocked project work", "Trabajo del proyecto bloqueado"), detail: String(blockedTasks.length) + " " + l("task(s) are blocked.", "tarea(s) están bloqueadas."), tone: "danger" as const } : null,
  ].filter(Boolean) as Array<{ label: string; detail: string; tone: "warning" | "danger" }>;

  return (
    <div className={"space-y-4 " + styles.detailsFirst} data-project-overview="project-command-center">
      <div className="grid gap-4 xl:grid-cols-[1.18fr_1fr_0.95fr]">
        <Panel title={l("Project Snapshot", "Resumen del proyecto")} icon={<Activity size={18} />} action={<Link href={projectHref + "/edit"} className={actionClass()}>{l("Edit", "Editar")}</Link>}>
          <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <div className="flex items-center justify-center"><ProgressRing progress={progress} label={l("Complete", "Completo")} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label={l("Customer", "Cliente")} value={props.customerName || l("Not assigned", "Sin asignar")} />
              <Info label={l("Project status", "Estado del proyecto")} value={props.statusLabel} />
              <Info label={l("Jobsite", "Sitio de trabajo")} value={props.projectAddress || l("Not entered", "Sin registrar")} icon={<MapPin size={14} />} />
              <Info label={l("Start date", "Fecha de inicio")} value={props.startDate} />
              <Info label={l("Target completion", "Finalización objetivo")} value={props.targetDate} />
              <Info label={l("Contract value", "Valor del contrato")} value={props.budgetLabel} />
            </div>
          </div>
          <div className="mt-4 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{l("Project scope", "Alcance del proyecto")}</p>
            <p className="mt-1 text-sm font-medium leading-6 text-[var(--bos-text-strong-on-light)]">{props.projectDescription?.trim() || l("No detailed scope has been entered yet.", "Aún no se ha ingresado un alcance detallado.")}</p>
          </div>
        </Panel>

        <Panel title={l("Schedule & Milestones", "Calendario e hitos")} icon={<CalendarDays size={18} />} action={<Link href={"/schedule?project=" + encodeURIComponent(props.projectId)} className={actionClass()}>{l("View Schedule", "Ver calendario")}</Link>}>
          <div className="grid grid-cols-2 gap-3">
            <Info label={l("Current phase", "Fase actual")} value={phaseLabel(props.projectStatus, es)} />
            <Info label={l("Next milestone", "Próximo hito")} value={upcoming[0]?.title || l("Not scheduled", "Sin programar")} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-neutral-200)]"><div className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-primary-600),var(--color-info-500))]" style={{ width: String(progress) + "%" }} /></div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <Milestone label={l("Planning", "Planificación")} state={progress > 0 ? "complete" : "current"} />
            <Milestone label={l("Execution", "Ejecución")} state={progress >= 25 && progress < 90 ? "current" : progress >= 90 ? "complete" : "upcoming"} />
            <Milestone label={l("Inspection", "Inspección")} state={props.pendingInspectionsCount > 0 ? "current" : "upcoming"} />
            <Milestone label={l("Closeout", "Cierre")} state={progress === 100 ? "complete" : "upcoming"} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniMetric label={l("Days remaining", "Días restantes")} value={daysRemainingLabel(props.targetDate, es)} />
            <MiniMetric label={l("Schedule health", "Salud del calendario")} value={blockedTasks.length ? l("Needs attention", "Requiere atención") : l("On track", "En curso")} warning={blockedTasks.length > 0} />
            <MiniMetric label={l("Target", "Objetivo")} value={props.targetDate} />
          </div>
        </Panel>

        <Panel title={l("Financial Health", "Salud financiera")} icon={<CircleDollarSign size={18} />} action={<Link href={projectHref + "?tab=financials"} className={actionClass()}>{l("View Financials", "Ver finanzas")}</Link>}>
          <div className="space-y-2">
            <MoneyRow label={l("Original contract", "Contrato original")} value={props.budgetLabel} />
            <MoneyRow label={l("Actual spend", "Gasto real")} value={props.spentLabel} />
            <MoneyRow label={l("Remaining", "Restante")} value={props.remainingLabel} strong />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniMetric label={l("Invoices", "Facturas")} value={String(props.invoicesCount)} />
            <MiniMetric label={l("Change orders", "Órdenes de cambio")} value={String(props.changeOrdersCount)} />
            <MiniMetric label={l("Estimates", "Estimados")} value={String(props.estimatesCount)} />
            <MiniMetric label={l("Budget status", "Estado del presupuesto")} value={l("Live", "En vivo")} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr]">
        <Panel title={l("Today on Site / Workforce", "Hoy en obra / Personal")} icon={<Users size={18} />} action={<Link href={projectHref + "?tab=crew"} className={actionClass()}>{l("Manage Crew", "Administrar cuadrilla")}</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <WorkforceMetric icon={<Users size={18} />} label={l("Assigned B.O.S. Crew", "Cuadrilla B.O.S. asignada")} value={props.crewCount ? String(props.crewCount) + " " + l("assignment(s)", "asignación(es)") : l("None Assigned", "Ninguna asignada")} />
            <WorkforceMetric icon={<HardHat size={18} />} label={l("Active project tasks", "Tareas activas del proyecto")} value={String(activeTasks.length)} />
            <WorkforceMetric icon={<ClipboardList size={18} />} label={l("Upcoming work", "Trabajo próximo")} value={String(upcoming.length)} />
            <WorkforceMetric icon={<CalendarDays size={18} />} label={l("Next scheduled work", "Próximo trabajo programado")} value={upcoming[0]?.planned_finish ? formatTaskDate(upcoming[0].planned_finish, es) : l("Not Scheduled", "Sin programar")} />
          </div>
        </Panel>

        <Panel title={l("Current Work / Next Up", "Trabajo actual / Próximo")} icon={<ClipboardList size={18} />} action={<Link href={projectHref + "?tab=tasks"} className={actionClass()}>{l("View Tasks", "Ver tareas")}</Link>}>
          <div className="divide-y divide-[var(--bos-border-light)]">
            {upcoming.length ? upcoming.map((task, index) => (
              <div key={task.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-extrabold text-[var(--color-primary-700)]">{index + 1}</span>
                <div className="min-w-0"><p className="truncate text-sm font-extrabold text-[var(--bos-text-strong-on-light)]">{task.title}</p><p className="text-xs font-medium text-[var(--bos-text-medium-on-light)]">{formatTaskDate(task.planned_finish, es)}</p></div>
                <Badge tone={normalize(task.status) === "blocked" ? "danger" : normalize(task.status) === "in_progress" ? "info" : "neutral"}>{pretty(task.status, es)}</Badge>
              </div>
            )) : <Empty label={l("No upcoming project work has been scheduled.", "No hay trabajo próximo programado para el proyecto.")} />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title={l("Risks & Decisions", "Riesgos y decisiones")} icon={<AlertTriangle size={18} />} action={<Link href={projectHref + "?tab=activity"} className={actionClass()}>{l("View All", "Ver todo")}</Link>}>
          <div className="space-y-2">
            {risks.length ? risks.map((risk) => (
              <div key={risk.label} className="flex items-start justify-between gap-3 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3">
                <div className="min-w-0"><p className="text-sm font-extrabold text-[var(--bos-text-strong-on-light)]">{risk.label}</p><p className="mt-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">{risk.detail}</p></div>
                <Badge tone={risk.tone}>{risk.tone === "danger" ? l("Blocked", "Bloqueado") : l("Action Needed", "Acción requerida")}</Badge>
              </div>
            )) : <div className="flex items-center gap-3 rounded-[12px] border border-[var(--color-success-200)] bg-[var(--color-success-50)] p-3"><ShieldCheck size={18} className="text-[var(--color-success-700)]" /><p className="text-sm font-extrabold text-[var(--color-success-800)]">{l("No immediate project risks are flagged.", "No hay riesgos inmediatos señalados.")}</p></div>}
          </div>
        </Panel>

        <Panel title={l("Project Signals", "Señales del proyecto")} icon={<ShieldCheck size={18} />}>
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric label={l("Open permits", "Permisos abiertos")} value={String(props.openPermitsCount)} warning={props.openPermitsCount > 0} />
            <MiniMetric label={l("Pending inspections", "Inspecciones pendientes")} value={String(props.pendingInspectionsCount)} warning={props.pendingInspectionsCount > 0} />
            <MiniMetric label={l("Open punch items", "Pendientes abiertos")} value={String(props.openPunchItemsCount)} warning={props.openPunchItemsCount > 0} />
            <MiniMetric label={l("Daily reports", "Reportes diarios")} value={String(props.dailyReportsCount)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title={l("Recent Activity", "Actividad reciente")} icon={<Activity size={18} />} action={<Link href={projectHref + "?tab=activity"} className={actionClass()}>{l("View All", "Ver todo")}</Link>}>
          <div className="divide-y divide-[var(--bos-border-light)]">
            {props.activityItems.slice(0, 5).length ? props.activityItems.slice(0, 5).map((item) => (
              <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 py-2.5">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--color-info-500)]" />
                <div className="min-w-0"><p className="truncate text-sm font-extrabold text-[var(--bos-text-strong-on-light)]">{item.title}</p><p className="truncate text-xs font-medium text-[var(--bos-text-medium-on-light)]">{item.detail}</p></div>
                <span className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{item.timestamp}</span>
              </div>
            )) : <Empty label={l("No recent project activity.", "No hay actividad reciente del proyecto.")} />}
          </div>
        </Panel>

        <Panel title={l("Recent Photos", "Fotos recientes")} icon={<ClipboardList size={18} />} action={<Link href={projectHref + "?tab=photos"} className={actionClass()}>{l("View Photos", "Ver fotos")}</Link>}>
          <div className="flex min-h-[154px] flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-5 text-center">
            <p className="text-3xl font-extrabold text-[var(--bos-text-strong-on-light)]">{props.photosCount}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{l("project photos on file", "fotos del proyecto archivadas")}</p>
            <Link href={projectHref + "?tab=photos"} className={getButtonClassName({ variant: "outline", size: "sm" }) + " mt-4"}>{l("Open Photo Log", "Abrir registro de fotos")}</Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-[18px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-4 shadow-[var(--shadow-small)] sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2 text-[var(--orion-blue)]">{icon}<h2 className="truncate text-lg font-extrabold text-[var(--bos-text-strong-on-light)]">{title}</h2></div>{action}</div>{children}</section>;
}

function ProgressRing({ progress, label }: { progress: number; label: string }) {
  const value = Math.max(0, Math.min(100, progress));
  return <div className="relative flex h-32 w-32 items-center justify-center rounded-full" style={{ background: "conic-gradient(var(--color-info-500) " + String(value * 3.6) + "deg, var(--color-neutral-200) 0deg)" }}><div className="flex h-[102px] w-[102px] flex-col items-center justify-center rounded-full bg-[var(--bos-bg-workspace-surface)]"><span className="text-3xl font-extrabold text-[var(--bos-text-strong-on-light)]">{value}%</span><span className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{label}</span></div></div>;
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 flex min-w-0 items-center gap-1.5 break-words text-sm font-extrabold text-[var(--bos-text-strong-on-light)]">{icon}{value}</p></div>;
}

function MoneyRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><span className="text-xs font-bold text-[var(--bos-text-medium-on-light)]">{label}</span><span className={strong ? "text-sm font-extrabold text-[var(--color-success-700)]" : "text-sm font-extrabold text-[var(--bos-text-strong-on-light)]"}>{value}</span></div>;
}

function MiniMetric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="min-w-0 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3"><p className="text-[9px] font-extrabold uppercase tracking-[.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className={warning ? "mt-1 break-words text-sm font-extrabold text-[var(--color-warning-700)]" : "mt-1 break-words text-sm font-extrabold text-[var(--bos-text-strong-on-light)]"}>{value}</p></div>;
}

function WorkforceMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-[14px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-4 text-center"><span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">{icon}</span><p className="mt-2 text-[10px] font-extrabold uppercase tracking-[.07em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 text-sm font-extrabold text-[var(--bos-text-strong-on-light)]">{value}</p></div>;
}

function Milestone({ label, state }: { label: string; state: "complete" | "current" | "upcoming" }) {
  const dot = state === "complete" ? "bg-[var(--color-success-500)]" : state === "current" ? "bg-[var(--color-info-500)]" : "bg-[var(--color-neutral-300)]";
  return <div className="min-w-0"><span className={"mx-auto block h-3 w-3 rounded-full " + dot} /><p className="mt-1 truncate text-[10px] font-bold text-[var(--bos-text-medium-on-light)]">{label}</p></div>;
}

function Empty({ label }: { label: string }) { return <p className="py-4 text-sm font-medium text-[var(--bos-text-medium-on-light)]">{label}</p>; }
function actionClass() { return "shrink-0 text-xs font-extrabold text-[var(--orion-blue)] hover:underline"; }
function normalize(value: string) { return value.trim().toLowerCase().replaceAll(" ", "_"); }

function pretty(value: string, es: boolean) {
  const normalized = normalize(value);
  if (es) {
    const labels: Record<string, string> = { completed: "Completada", in_progress: "En progreso", blocked: "Bloqueada", pending: "Pendiente", todo: "Pendiente", not_started: "No iniciada" };
    if (labels[normalized]) return labels[normalized];
  }
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTaskDate(value: string | null, es: boolean) {
  return value ? new Intl.DateTimeFormat(es ? "es-US" : "en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value + "T12:00:00")) : es ? "Sin programar" : "Not scheduled";
}

function daysRemainingLabel(value: string, es: boolean) {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return es ? "Sin programar" : "Not scheduled";
  const days = Math.ceil((target.getTime() - Date.now()) / 86400000);
  return days < 0 ? String(Math.abs(days)) + " " + (es ? "días tarde" : "days overdue") : String(days) + " " + (es ? "días" : "days");
}

function phaseLabel(projectStatus: string, es: boolean) {
  const normalized = normalize(projectStatus);
  if (normalized === "completed") return es ? "Cierre" : "Closeout";
  if (normalized === "in_progress") return es ? "Construcción" : "Construction";
  if (normalized === "scheduled") return es ? "Programado" : "Scheduled";
  if (normalized === "on_hold") return es ? "En espera" : "On Hold";
  if (normalized === "approved") return es ? "Preconstrucción" : "Pre-Construction";
  return pretty(projectStatus || (es ? "Planificación" : "Planning"), es);
}
