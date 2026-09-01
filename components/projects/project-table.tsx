"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  EnterpriseTable,
  EnterpriseTableBody,
  EnterpriseTableCell,
  EnterpriseTableHead,
  EnterpriseTableHeading,
  EnterpriseTableRow,
  TableContainer,
} from "@/components/ui";
import { ProjectActions } from "./project-actions";
import { ProjectAvatar } from "./project-avatar";
import { ProjectProgress } from "./project-progress";
import { ProjectStatusBadge } from "./project-status-badge";

export type ProjectTableItem = {
  id: string;
  projectName: string;
  customerName: string;
  superintendentName: string;
  statusKey: string;
  statusLabel: string;
  budgetLabel: string;
  spentLabel: string;
  profitMarginLabel: string;
  progress: number;
  dueDateLabel: string;
  healthKey: "on_track" | "at_risk" | "behind" | "complete";
  healthLabel: string;
};

type ProjectTableProps = {
  items: ProjectTableItem[];
  t: (key: string, params?: Record<string, string | number>) => string;
  canManageProjects: boolean;
  showFinancials: boolean;
};

type DeletedProjectResponse = {
  projects?: Array<{ projectId: string }>;
};

export function ProjectTable({ items, t, canManageProjects, showFinancials }: ProjectTableProps) {
  const router = useRouter();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    void fetch("/api/projects/deleted", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as DeletedProjectResponse;
      })
      .then((body) => {
        if (!active || !body?.projects) return;
        setDeletedIds(new Set(body.projects.map((project) => project.projectId)));
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(() => items.filter((project) => !deletedIds.has(project.id)), [deletedIds, items]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" aria-label="Project lifecycle views">
        <span
          aria-current="page"
          className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-brand-500)] bg-[var(--color-brand-600)] px-3 py-2 text-sm font-semibold text-white shadow-[var(--shadow-small)]"
        >
          Projects
        </span>
        {canManageProjects ? (
          <Link
            href="/projects/deleted"
            className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-brand-500)] hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]"
          >
            Previously Deleted
          </Link>
        ) : null}
      </div>

      <TableContainer title={t("projects.directoryTitle")} description={t("projects.directoryDescription")}>
        <EnterpriseTable ariaLabel={t("projects.directoryTitle")} minWidthClassName="min-w-[1080px]">
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTableHeading>{t("projects.tableProject")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableStatus")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableProgress")}</EnterpriseTableHeading>
              {showFinancials ? <EnterpriseTableHeading>{t("projects.tableBudget")}</EnterpriseTableHeading> : null}
              {showFinancials ? <EnterpriseTableHeading>Recorded</EnterpriseTableHeading> : null}
              {showFinancials ? <EnterpriseTableHeading>Margin</EnterpriseTableHeading> : null}
              <EnterpriseTableHeading>Superintendent</EnterpriseTableHeading>
              <EnterpriseTableHeading>Due Date</EnterpriseTableHeading>
              <EnterpriseTableHeading>Health</EnterpriseTableHeading>
              {canManageProjects ? <EnterpriseTableHeading align="right">{t("projects.tableActions")}</EnterpriseTableHeading> : null}
            </tr>
          </EnterpriseTableHead>

          <EnterpriseTableBody>
            {visibleItems.map((project) => (
              <EnterpriseTableRow
                key={project.id}
                className="cursor-pointer transition-all duration-200 hover:-translate-y-px hover:bg-[var(--color-surface-subtle)]/80 hover:shadow-[0_10px_24px_-20px_rgba(15,23,42,0.28)]"
                role="link"
                tabIndex={0}
                aria-label={`${t("projects.viewWorkspace")} ${project.projectName}`}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest("a,button,input,select,textarea")) return;
                  router.push(`/projects/${project.id}`);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  router.push(`/projects/${project.id}`);
                }}
              >
                <EnterpriseTableCell>
                  <div className="flex min-w-[190px] items-start gap-3">
                    <ProjectAvatar name={project.projectName} />
                    <div className="min-w-0">
                      <Link href={`/projects/${project.id}`} className="block truncate text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">
                        {project.projectName}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{project.customerName}</p>
                    </div>
                  </div>
                </EnterpriseTableCell>
                <EnterpriseTableCell><ProjectStatusBadge statusKey={project.statusKey} label={project.statusLabel} /></EnterpriseTableCell>
                <EnterpriseTableCell><ProjectProgress value={project.progress} /></EnterpriseTableCell>
                {showFinancials ? <EnterpriseTableCell className="font-semibold">{project.budgetLabel}</EnterpriseTableCell> : null}
                {showFinancials ? <EnterpriseTableCell>{project.spentLabel}</EnterpriseTableCell> : null}
                {showFinancials ? <EnterpriseTableCell className="font-semibold">{project.profitMarginLabel}</EnterpriseTableCell> : null}
                <EnterpriseTableCell>{project.superintendentName}</EnterpriseTableCell>
                <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{project.dueDateLabel}</EnterpriseTableCell>
                <EnterpriseTableCell><Badge tone={getHealthTone(project.healthKey)}>{project.healthLabel}</Badge></EnterpriseTableCell>
                {canManageProjects ? (
                  <EnterpriseTableCell align="right">
                    <ProjectActions projectId={project.id} projectName={project.projectName} viewLabel={t("projects.viewWorkspace")} moreLabel={t("projects.actionsMore")} />
                  </EnterpriseTableCell>
                ) : null}
              </EnterpriseTableRow>
            ))}
          </EnterpriseTableBody>
        </EnterpriseTable>
      </TableContainer>
    </div>
  );
}

function getHealthTone(projectHealth: ProjectTableItem["healthKey"]): "brand" | "success" | "warning" | "danger" | "neutral" {
  if (projectHealth === "complete") return "success";
  if (projectHealth === "at_risk") return "warning";
  if (projectHealth === "behind") return "danger";
  if (projectHealth === "on_track") return "brand";
  return "neutral";
}
