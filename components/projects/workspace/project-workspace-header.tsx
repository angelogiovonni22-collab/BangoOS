"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  Pencil,
  Receipt,
  Share2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, getButtonClassName } from "@/components/ui";
import { WorkspaceHeader } from "@/components/workspace";
import { useI18n } from "@/lib/i18n/provider";
import { ProjectHeaderWeatherStrip } from "./project-header-weather-strip";

type ProjectWorkspaceHeaderProps = {
  projectName: string;
  projectNumber: string | null;
  customerLabel: string;
  customerProjectsHref: string;
  statusLabel: string;
  statusKey: string;
  customerHref: string | null;
  editProjectHref?: string | null;
  estimateHref?: string | null;
  invoiceHref?: string | null;
};

export function ProjectWorkspaceHeader({
  projectName,
  projectNumber,
  customerLabel,
  customerProjectsHref,
  statusLabel,
  statusKey,
  editProjectHref,
  estimateHref,
  invoiceHref,
}: ProjectWorkspaceHeaderProps) {
  const { locale } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
  const pathname = usePathname();
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusTone = useMemo(() => statusToneClass(statusKey), [statusKey]);
  const projectId = useMemo(() => {
    const match = pathname.match(/^\/projects\/([^/?#]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  useEffect(() => {
    if (shareState !== "copied") return;
    const timeoutId = window.setTimeout(() => setShareState("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [shareState]);

  const handleShare = async () => {
    if (typeof window === "undefined") return;

    const sharePayload = {
      title: projectName,
      text: `${l("Project workspace", "Espacio de trabajo del proyecto")}: ${projectName}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(sharePayload);
        return;
      } catch {
        // Fall back to clipboard.
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(window.location.href);
      setShareState("copied");
    }
  };

  const handleProjectStatus = async (nextStatus: "in_progress" | "on_hold" | "delayed" | "completed") => {
    if (!projectId || statusBusy) return;
    setStatusMenuOpen(false);

    if (nextStatus === "completed") {
      const confirmed = window.confirm(
        es
          ? `¿Completar ${projectName}? B.O.S. iniciará el cierre, preparará la factura final y quitará el proyecto de los portales activos de socios comerciales.`
          : `Complete ${projectName}? B.O.S. will start closeout, prepare the final invoice, and remove the project from active Trade Partner portals.`,
      );
      if (!confirmed) return;

      setStatusBusy(true);
      setStatusMessage(null);
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/complete`, { method: "POST" });
        const body = await response.json() as { error?: string; message?: string };
        if (!response.ok) throw new Error(body.error || l("Unable to complete project.", "No se pudo completar el proyecto."));
        setStatusMessage(body.message || l("Project completed.", "Proyecto completado."));
        window.setTimeout(() => window.location.reload(), 500);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : l("Unable to complete project.", "No se pudo completar el proyecto."));
      } finally {
        setStatusBusy(false);
      }
      return;
    }

    let reason = "";
    if (nextStatus === "on_hold" || nextStatus === "delayed") {
      const promptText = nextStatus === "on_hold"
        ? l("Why is this project being paused? This reason will be included in the Trade Partner alert.", "¿Por qué se pausa este proyecto? Este motivo se incluirá en la alerta al socio comercial.")
        : l("Why is this project delayed? This reason will be included in the Trade Partner alert.", "¿Por qué está retrasado este proyecto? Este motivo se incluirá en la alerta al socio comercial.");
      const entered = window.prompt(promptText, "");
      if (entered === null) return;
      reason = entered.trim();
      if (!reason) {
        setStatusMessage(l("Enter a reason before pausing or delaying the project.", "Ingresa un motivo antes de pausar o retrasar el proyecto."));
        return;
      }
    }

    setStatusBusy(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || l("Unable to update project status.", "No se pudo actualizar el estado del proyecto."));
      setStatusMessage(body.message || l("Project status updated.", "Estado del proyecto actualizado."));
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : l("Unable to update project status.", "No se pudo actualizar el estado del proyecto."));
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <div data-project-header-with-jobsite-intelligence="true">
      <WorkspaceHeader
        compact
        breadcrumbs={[
          { label: l("Projects", "Proyectos"), href: "/projects" },
          { label: customerLabel, href: customerProjectsHref },
          { label: projectName },
        ]}
        title={projectName}
        subtitle={projectNumber ? `${l("Project Workspace", "Espacio de trabajo del proyecto")} · ${projectNumber}` : l("Project Workspace", "Espacio de trabajo del proyecto")}
        badgeLabel={statusLabel}
        badgeTone={statusTone}
        actions={
          <div className="flex flex-col items-end gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full justify-center rounded-[11px] border-[#5678a7] bg-[#152a4b] px-3.5 py-2 text-[0.8rem] font-semibold text-[#e7f1ff] hover:bg-[#1d3c68] disabled:border-[#3d5478] disabled:bg-[#122038] disabled:text-[#9ab0cd]"
                onClick={() => void handleShare()}
              >
                <Share2 size={15} aria-hidden="true" />
                {shareState === "copied" ? l("Copied", "Copiado") : l("Share", "Compartir")}
              </Button>

              {editProjectHref ? (
                <Link
                  href={editProjectHref}
                  className={`${getButtonClassName({ variant: "primary", size: "sm" })} w-full justify-center rounded-[11px] border border-[#9ecfff] bg-[linear-gradient(180deg,#3b77be,#2d5f9f)] px-3.5 py-2 text-[0.8rem] font-semibold shadow-[0_12px_22px_-14px_rgba(30,120,255,0.84)]`}
                >
                  <Pencil size={15} aria-hidden="true" />
                  {l("Edit Project", "Editar proyecto")}
                </Link>
              ) : <span />}

              {estimateHref ? (
                <Link
                  href={estimateHref}
                  aria-label={l("View original estimate", "Ver estimación original")}
                  className={`${getButtonClassName({ variant: "outline", size: "sm" })} w-full justify-center rounded-[11px] border-[#5678a7] bg-[#152a4b] px-3.5 py-2 text-[0.8rem] font-semibold text-[#e7f1ff] hover:bg-[#1d3c68]`}
                >
                  <FileText size={15} aria-hidden="true" />
                  {l("View Estimate", "Ver estimación")}
                </Link>
              ) : (
                <Button type="button" size="sm" variant="outline" disabled className="w-full justify-center rounded-[11px] px-3.5 py-2 text-[0.8rem] font-semibold">
                  <FileText size={15} aria-hidden="true" />
                  {l("View Estimate", "Ver estimación")}
                </Button>
              )}

              {invoiceHref ? (
                <Link
                  href={invoiceHref}
                  aria-label={l("View project invoice", "Ver factura del proyecto")}
                  className={`${getButtonClassName({ variant: "outline", size: "sm" })} w-full justify-center rounded-[11px] border-[#5678a7] bg-[#152a4b] px-3.5 py-2 text-[0.8rem] font-semibold text-[#e7f1ff] hover:bg-[#1d3c68]`}
                >
                  <Receipt size={15} aria-hidden="true" />
                  {l("Invoice", "Factura")}
                </Link>
              ) : (
                <Button type="button" size="sm" variant="outline" disabled className="w-full justify-center rounded-[11px] px-3.5 py-2 text-[0.8rem] font-semibold">
                  <Receipt size={15} aria-hidden="true" />
                  {l("Invoice", "Factura")}
                </Button>
              )}
            </div>

            {statusKey !== "cancelled" ? (
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={statusBusy || !projectId || statusKey === "completed"}
                  onClick={() => setStatusMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={statusMenuOpen}
                  className={`min-w-[190px] justify-between rounded-[11px] px-3.5 py-2 text-[0.8rem] font-semibold ${projectStatusControlClass(statusKey)}`}
                >
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 size={15} aria-hidden="true" />
                    {statusBusy ? l("Updating Status…", "Actualizando estado…") : `${l("Project Status", "Estado del proyecto")}: ${projectStatusActionLabel(statusKey, es)}`}
                  </span>
                  {statusKey !== "completed" ? <ChevronDown size={14} aria-hidden="true" /> : null}
                </Button>
                {statusMenuOpen && statusKey !== "completed" ? (
                  <div role="menu" className="absolute right-0 z-50 mt-2 w-[210px] overflow-hidden rounded-xl border border-[#41658d] bg-[#0b1930] p-1.5 shadow-2xl">
                    {[
                      { value: "in_progress" as const, label: l("Active", "Activo") },
                      { value: "on_hold" as const, label: l("Paused", "Pausado") },
                      { value: "delayed" as const, label: l("Delayed", "Retrasado") },
                      { value: "completed" as const, label: l("Complete", "Completo") },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitem"
                        onClick={() => void handleProjectStatus(option.value)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-[#e6f0ff] hover:bg-[#17345a]"
                      >
                        <span>{option.label}</span>
                        {statusKey === option.value ? <CheckCircle2 size={14} className="text-emerald-300" aria-hidden="true" /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        }
      />
      {statusMessage ? <div className="mx-4 mt-2 rounded-lg border border-sky-300/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-100">{statusMessage}</div> : null}
      <ProjectHeaderWeatherStrip />
    </div>
  );
}

function statusToneClass(statusKey: string): "brand" | "success" | "warning" | "danger" | "neutral" | "info" {
  if (statusKey === "completed") return "success";
  if (statusKey === "cancelled") return "danger";
  if (statusKey === "on_hold" || statusKey === "delayed") return "warning";
  if (statusKey === "estimating" || statusKey === "lead") return "neutral";
  return "brand";
}


function projectStatusActionLabel(statusKey: string, es: boolean) {
  if (statusKey === "in_progress") return es ? "Activo" : "Active";
  if (statusKey === "on_hold") return es ? "Pausado" : "Paused";
  if (statusKey === "delayed") return es ? "Retrasado" : "Delayed";
  if (statusKey === "completed") return es ? "Completo" : "Complete";
  if (statusKey === "approved") return es ? "Aprobado" : "Approved";
  if (statusKey === "scheduled") return es ? "Programado" : "Scheduled";
  return statusKey.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function projectStatusControlClass(statusKey: string) {
  if (statusKey === "completed") return "border-emerald-500/60 bg-emerald-500/10 text-emerald-200";
  if (statusKey === "delayed") return "border-rose-400/60 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20";
  if (statusKey === "on_hold") return "border-amber-400/60 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20";
  if (statusKey === "in_progress") return "border-sky-400/60 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20";
  return "border-[#5678a7] bg-[#152a4b] text-[#e7f1ff] hover:bg-[#1d3c68]";
}
