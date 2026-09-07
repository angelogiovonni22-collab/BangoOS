import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, Bot, Boxes, ClipboardCheck, FileCheck2, Gauge, ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ProjectSuperintendentBriefing } from "@/lib/project-intelligence/briefing/briefing-types";
import type { ProjectIntelligence } from "@/lib/project-intelligence/intelligence-types";
import { calculateProjectComplianceReadiness, type ProjectComplianceSignals } from "@/lib/projects/project-compliance-readiness";
import { calculateProjectExecutionReadiness } from "@/lib/projects/project-execution-readiness";
import { useI18n } from "@/lib/i18n/provider";

type ProjectOperatingSystemPanelProps = {
  intelligence: ProjectIntelligence;
  briefing: ProjectSuperintendentBriefing;
  projectId: string;
  compliance: ProjectComplianceSignals;
  timelineCount: number;
  formatCurrency: (amount: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectOperatingSystemPanel({ intelligence, briefing, projectId, compliance, timelineCount, formatCurrency, t }: ProjectOperatingSystemPanelProps) {
  const { locale } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
  const score = calculateOperatingScore(intelligence, timelineCount);
  const scoreTone = getScoreTone(score);
  const complianceReadiness = calculateProjectComplianceReadiness(compliance);
  const executionReadiness = calculateProjectExecutionReadiness({
    complianceScore: complianceReadiness.score,
    overdueTasks: intelligence.summary.overdueTasks,
    blockedTasks: intelligence.summary.blockedTasks,
    activeTasks: intelligence.summary.activeTasks,
    documentationPresent: intelligence.quality.documentationPresent,
  });
  const executionAction = getExecutionAction(projectId, executionReadiness.nextAction, es);
  const varianceLabel = intelligence.budget.budgetVariance === null
    ? l("Budget baseline required", "Se requiere una línea base del presupuesto")
    : formatCurrency(intelligence.budget.budgetVariance);

  return (
    <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
      <CardHeader className="border-b border-[var(--color-border-subtle)] bg-[linear-gradient(135deg,rgba(37,99,235,0.08),rgba(34,197,94,0.08),rgba(255,255,255,0.95))]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--color-primary-100)] text-[var(--color-brand-700)]">
              <Gauge size={16} aria-hidden="true" />
            </span>
            <CardTitle className="text-[1.15rem] font-bold text-[var(--color-navy-900)]">{l("B.O.S. Project Operating System", "Sistema Operativo de Proyecto B.O.S.")}</CardTitle>
          </div>
          <Badge tone={scoreTone}>{score}/100</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <Link href={`/projects/${projectId}/materials`} className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--color-brand-200)] bg-[var(--color-primary-50)] px-4 py-3 transition hover:border-[var(--color-brand-400)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]">
          <span className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary-600)] text-white"><Boxes size={18} aria-hidden="true" /></span><span><span className="block text-sm font-semibold text-[var(--color-navy-900)]">{l("Materials & Procurement", "Materiales y compras")}</span><span className="block text-xs text-[var(--color-text-secondary)]">{l("Review estimate materials, inventory, current costs, and purchasing status.", "Revisa materiales del presupuesto, inventario, costos actuales y estado de compras.")}</span></span></span>
          <span className="text-xs font-semibold text-[var(--color-brand-700)]">{l("Open plan", "Abrir plan")}</span>
        </Link>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile label={l("Operating Score", "Puntuación operativa")} value={`${score}/100`} note={scoreSummary(score, es)} />
          <MetricTile
            label={l("Delivery Risk", "Riesgo de entrega")}
            value={intelligence.risk.highestSeverity ? localizeSeverity(intelligence.risk.highestSeverity, es) : l("Low", "Bajo")}
            note={`${intelligence.risk.totalRisks} ${l("active risk signals", "señales de riesgo activas")}`}
          />
          <MetricTile
            label={l("Budget Variance", "Variación del presupuesto")}
            value={varianceLabel}
            note={`${intelligence.budget.overdueInvoices} ${l("overdue invoices", "facturas vencidas")}`}
          />
          <MetricTile
            label={l("Workflow Coverage", "Cobertura del flujo")}
            value={`${timelineCount} ${l("events", "eventos")}`}
            note={`${intelligence.quality.photosCount} ${l("photos", "fotos")} · ${intelligence.summary.activeTasks} ${l("active tasks", "tareas activas")}`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-navy-900)]">
              <ShieldCheck size={15} aria-hidden="true" />
              {l("Risk Priorities", "Prioridades de riesgo")}
            </p>
            <ul className="mt-3 space-y-2">
              {intelligence.risk.risks.length === 0 ? (
                <li className="text-sm text-[var(--color-text-secondary)]">{l("No critical risks are currently flagged.", "Actualmente no hay riesgos críticos señalados.")}</li>
              ) : (
                intelligence.risk.risks.slice(0, 3).map((risk) => (
                  <li key={risk.id} className="rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                    <span className="font-semibold text-[var(--color-text-primary)]">{localizeSeverity(risk.severity, es)}:</span> {risk.message}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-navy-900)]">
              <Bot size={15} aria-hidden="true" />
              {l("Orion Recommended Actions", "Acciones recomendadas por Orion")}
            </p>
            <ul className="mt-3 space-y-2">
              {briefing.recommendedActions.length === 0 ? (
                <li className="text-sm text-[var(--color-text-secondary)]">{l("No recommended actions yet. Continue tracking project updates.", "Aún no hay acciones recomendadas. Continúa registrando las actualizaciones del proyecto.")}</li>
              ) : (
                briefing.recommendedActions.slice(0, 3).map((action) => (
                  <li key={action.id} className="rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(action.titleKey)}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t(action.explanationKey)}</p>
                    {action.href ? (
                      <Link href={action.href} className="mt-2 inline-flex text-xs font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                        {l("Open action", "Abrir acción")}
                      </Link>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-white p-4" data-testid="project-compliance-readiness">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-navy-900)]">
                <ShieldCheck size={15} aria-hidden="true" />
                {l("Compliance Readiness", "Preparación de cumplimiento")}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{l("Live permit, inspection, and project-document coverage.", "Cobertura en vivo de permisos, inspecciones y documentos del proyecto.")}</p>
            </div>
            <Badge tone={complianceReadiness.status === "Ready" ? "success" : complianceReadiness.status === "Watch" ? "warning" : "danger"}>
              {complianceReadiness.score}/100 · {localizeReadinessStatus(complianceReadiness.status, es)}
            </Badge>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <ComplianceTile icon={<FileCheck2 size={15} aria-hidden="true" />} label={l("Permits", "Permisos")} value={localizeState(complianceReadiness.permitState, es)} note={`${compliance.openPermits} ${l("open", "abiertos")} · ${compliance.permitsTotal} ${l("total", "total")}`} />
            <ComplianceTile icon={<ClipboardCheck size={15} aria-hidden="true" />} label={l("Inspections", "Inspecciones")} value={localizeState(complianceReadiness.inspectionState, es)} note={`${compliance.pendingInspections} ${l("pending", "pendientes")} · ${compliance.inspectionsTotal} ${l("total", "total")}`} />
            <ComplianceTile icon={<ShieldCheck size={15} aria-hidden="true" />} label={l("Documents", "Documentos")} value={localizeState(complianceReadiness.documentState, es)} note={`${compliance.documentsTotal} ${l("project records", "registros del proyecto")}`} />
          </div>
        </div>

        <div className="rounded-[14px] border border-[var(--color-border-subtle)] bg-white p-4" data-testid="project-execution-readiness">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-navy-900)]">
                <Activity size={15} aria-hidden="true" />
                {l("Execution Readiness", "Preparación de ejecución")}
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{l("Combines compliance, task blockers, overdue work, and field documentation into the next operating move.", "Combina cumplimiento, bloqueos de tareas, trabajo vencido y documentación de campo para determinar la siguiente acción operativa.")}</p>
            </div>
            <Badge tone={executionReadiness.status === "Ready" ? "success" : executionReadiness.status === "Watch" ? "warning" : "danger"}>
              {executionReadiness.score}/100 · {localizeReadinessStatus(executionReadiness.status, es)}
            </Badge>
          </div>
          <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{l("Next operating action", "Siguiente acción operativa")}</p>
              <p className="mt-1 break-words text-sm font-semibold text-[var(--color-text-primary)]">{executionAction.label}</p>
              <p className="mt-1 break-words text-xs text-[var(--color-text-secondary)]">{executionAction.note}</p>
            </div>
            <Link href={executionAction.href} className="inline-flex shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-brand-300)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-brand-700)] transition hover:bg-[var(--color-primary-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]">
              {l("Open action", "Abrir acción")}
            </Link>
          </div>
        </div>

        {intelligence.summary.overdueTasks > 0 || intelligence.summary.blockedTasks > 0 ? (
          <div className="flex items-start gap-2 rounded-[12px] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2.5 text-sm text-[var(--color-warning-800)]">
            <AlertTriangle size={15} className="mt-0.5" aria-hidden="true" />
            <p>{l("Immediate attention", "Atención inmediata")}: {intelligence.summary.overdueTasks} {l("overdue tasks", "tareas vencidas")} {l("and", "y")} {intelligence.summary.blockedTasks} {l("blocked tasks are reducing operating stability.", "tareas bloqueadas están reduciendo la estabilidad operativa.")}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ComplianceTile({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{icon}{label}</span>
      <span className="mt-1 block break-words text-base font-bold text-[var(--color-text-primary)]">{value}</span>
      <span className="mt-1 block break-words text-xs text-[var(--color-text-secondary)]">{note}</span>
    </div>
  );
}

function MetricTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{note}</p>
    </div>
  );
}

function getExecutionAction(projectId: string, nextAction: "compliance" | "blocked" | "overdue" | "documentation" | "execution", es: boolean) {
  if (nextAction === "compliance") return { label: es ? "Completar configuración de cumplimiento" : "Complete compliance setup", note: es ? "Resuelve las brechas de permisos, inspecciones y documentos obligatorios antes de avanzar el trabajo." : "Resolve permit, inspection, and required document gaps before work advances.", href: `/projects/${projectId}?tab=inspections` };
  if (nextAction === "blocked") return { label: es ? "Despejar trabajo bloqueado" : "Clear blocked work", note: es ? "Revisa las tareas bloqueadas y elimina primero las restricciones de ejecución." : "Review blocked tasks and remove execution constraints first.", href: `/projects/${projectId}?tab=tasks` };
  if (nextAction === "overdue") return { label: es ? "Recuperar trabajo vencido" : "Recover overdue work", note: es ? "Prioriza las tareas vencidas para restaurar el plan activo del proyecto." : "Prioritize overdue tasks to restore the active project plan.", href: `/projects/${projectId}?tab=tasks` };
  if (nextAction === "documentation") return { label: es ? "Capturar documentación de campo" : "Capture field documentation", note: es ? "Agrega evidencia del proyecto para mantener trazables las decisiones de ejecución." : "Add project evidence so execution decisions remain traceable.", href: `/projects/${projectId}?tab=documents` };
  return { label: es ? "Continuar ejecución planificada" : "Continue planned execution", note: es ? "Las señales actuales de preparación permiten avanzar el plan activo del proyecto." : "Current readiness signals support advancing the active project plan.", href: `/projects/${projectId}?tab=tasks` };
}

function calculateOperatingScore(intelligence: ProjectIntelligence, timelineCount: number) {
  const healthBase = intelligence.summary.healthScore ?? 52;
  const overduePenalty = Math.min(25, intelligence.summary.overdueTasks * 3);
  const blockedPenalty = Math.min(18, intelligence.summary.blockedTasks * 2);
  const riskPenalty = intelligence.risk.highestSeverity === "critical" ? 20 : intelligence.risk.highestSeverity === "high" ? 12 : intelligence.risk.highestSeverity === "medium" ? 6 : 0;
  const timelineBonus = Math.min(8, Math.floor(timelineCount / 4));
  const documentationBonus = intelligence.quality.documentationPresent ? 4 : 0;
  return clampScore(healthBase - overduePenalty - blockedPenalty - riskPenalty + timelineBonus + documentationBonus);
}

function clampScore(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function getScoreTone(score: number): "brand" | "success" | "warning" | "danger" | "neutral" { if (score >= 85) return "success"; if (score >= 70) return "brand"; if (score >= 55) return "warning"; return "danger"; }
function scoreSummary(score: number, es: boolean) { if (score >= 85) return es ? "Postura operativa saludable" : "Healthy operating posture"; if (score >= 70) return es ? "Estable con observaciones menores" : "Stable with minor watch items"; if (score >= 55) return es ? "Se recomienda atención esta semana" : "Attention recommended this week"; return es ? "Se necesitan acciones de recuperación ahora" : "Recovery actions needed now"; }
function localizeSeverity(value: string, es: boolean) { if (!es) return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(); const map: Record<string,string> = { low: "Bajo", medium: "Medio", high: "Alto", critical: "Crítico" }; return map[value.toLowerCase()] || value; }
function localizeReadinessStatus(value: string, es: boolean) { if (!es) return value; const map: Record<string,string> = { Ready: "Listo", Watch: "Vigilar", Blocked: "Bloqueado", "In progress": "En progreso", "Not started": "No iniciado" }; return map[value] || value; }
function localizeState(value: string, es: boolean) { if (!es) return value; const map: Record<string,string> = { Complete: "Completo", Clear: "Sin pendientes", Ready: "Listo", Watch: "Vigilar", Blocked: "Bloqueado", Missing: "Faltante", Pending: "Pendiente", Open: "Abierto", "Not started": "No iniciado" }; return map[value] || value; }
