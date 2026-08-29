"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Pencil,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, getButtonClassName } from "@/components/ui";
import { WorkspaceHeader } from "@/components/workspace";
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
};

export function ProjectWorkspaceHeader({
  projectName,
  projectNumber,
  customerLabel,
  customerProjectsHref,
  statusLabel,
  statusKey,
  customerHref,
  editProjectHref,
}: ProjectWorkspaceHeaderProps) {
  const pathname = usePathname();
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [completeBusy, setCompleteBusy] = useState(false);
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);
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
      text: `Project workspace: ${projectName}`,
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

  const handleCompleteProject = async () => {
    if (!projectId || statusKey === "completed") return;
    const confirmed = window.confirm(
      `Mark ${projectName} complete? B.O.S. will automatically remove this project from active Trade Partner portals and preserve all contractor history.`,
    );
    if (!confirmed) return;

    setCompleteBusy(true);
    setCompleteMessage(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/complete`, { method: "POST" });
      const body = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(body.error || "Unable to complete project.");
      setCompleteMessage(body.message || "Project completed.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      setCompleteMessage(error instanceof Error ? error.message : "Unable to complete project.");
    } finally {
      setCompleteBusy(false);
    }
  };

  return (
    <div data-project-header-with-jobsite-intelligence="true">
      <WorkspaceHeader
        compact
        breadcrumbs={[
          { label: "Projects", href: "/projects" },
          { label: customerLabel, href: customerProjectsHref },
          { label: projectName },
        ]}
        title={projectName}
        subtitle={projectNumber ? `Project Workspace · ${projectNumber}` : "Project Workspace"}
        badgeLabel={statusLabel}
        badgeTone={statusTone}
        actions={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-[11px] border-[#5678a7] bg-[#152a4b] px-3.5 py-2 text-[0.8rem] font-semibold text-[#e7f1ff] hover:bg-[#1d3c68] disabled:border-[#3d5478] disabled:bg-[#122038] disabled:text-[#9ab0cd]"
              onClick={() => void handleShare()}
            >
              <Share2 size={15} aria-hidden="true" />
              {shareState === "copied" ? "Copied" : "Share"}
            </Button>

            <details className="group relative shrink-0">
              <summary className="list-none">
                <Button
                  size="sm"
                  variant="primary"
                  className="rounded-[11px] border border-[#6a97cf] bg-[linear-gradient(180deg,#295891,#1d4478)] px-3.5 py-2 text-[0.8rem] font-semibold text-white shadow-[0_10px_20px_-14px_rgba(30,120,255,0.82)] hover:brightness-110"
                  aria-label="More actions"
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                  More
                  <ChevronDown size={14} aria-hidden="true" />
                </Button>
              </summary>
              <div className="absolute right-0 z-[var(--z-overlay)] mt-2 w-max min-w-[240px] max-w-[min(22rem,calc(100vw-2rem))] rounded-[12px] border border-[#4c6ea1] bg-[#102748] p-1.5 shadow-[0_18px_32px_-18px_rgba(2,6,17,0.95)]">
                {statusKey !== "completed" && statusKey !== "cancelled" ? (
                  <button
                    type="button"
                    disabled={completeBusy || !projectId}
                    onClick={() => void handleCompleteProject()}
                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm font-semibold text-emerald-200 transition hover:bg-[#1a3968] disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} aria-hidden="true" />
                    {completeBusy ? "Completing Project…" : "Project Complete"}
                  </button>
                ) : null}
                {customerHref ? (
                  <Link
                    href={customerHref}
                    className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold text-[#edf4ff] transition hover:bg-[#1a3968]"
                  >
                    <ExternalLink size={15} aria-hidden="true" />
                    Open Customer
                  </Link>
                ) : null}
                <Link
                  href={customerProjectsHref}
                  className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold text-[#edf4ff] transition hover:bg-[#1a3968]"
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                  Back to Customer Projects
                </Link>
              </div>
            </details>

            {editProjectHref ? (
              <Link
                href={editProjectHref}
                className={`${getButtonClassName({ variant: "primary", size: "sm" })} rounded-[11px] border border-[#9ecfff] bg-[linear-gradient(180deg,#3b77be,#2d5f9f)] px-3.5 py-2 text-[0.8rem] font-semibold shadow-[0_12px_22px_-14px_rgba(30,120,255,0.84)]`}
              >
                <Pencil size={15} aria-hidden="true" />
                Edit Project
              </Link>
            ) : null}
          </>
        }
      />
      {completeMessage ? <div className="mx-4 mt-2 rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100">{completeMessage}</div> : null}
      <ProjectHeaderWeatherStrip />
    </div>
  );
}

function statusToneClass(statusKey: string): "brand" | "success" | "warning" | "danger" | "neutral" | "info" {
  if (statusKey === "completed") return "success";
  if (statusKey === "cancelled") return "danger";
  if (statusKey === "on_hold") return "warning";
  if (statusKey === "estimating" || statusKey === "lead") return "neutral";
  return "brand";
}
