import Link from "next/link";
import {
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
  projectManagerName: string;
  statusKey: string;
  statusLabel: string;
  budgetLabel: string;
  progress: number;
  startDateLabel: string;
  endDateLabel: string;
  lastActivityLabel: string;
};

type ProjectTableProps = {
  items: ProjectTableItem[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectTable({ items, t }: ProjectTableProps) {
  return (
    <TableContainer
      title={t("projects.directoryTitle")}
      description={t("projects.directoryDescription")}
    >
      <EnterpriseTable ariaLabel={t("projects.directoryTitle")} minWidthClassName="min-w-[1260px]">
          <EnterpriseTableHead>
            <tr>
              <EnterpriseTableHeading>{t("projects.tableProject")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableCustomer")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableProjectManager")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableStatus")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableBudget")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableProgress")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableStartDate")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableEndDate")}</EnterpriseTableHeading>
              <EnterpriseTableHeading>{t("projects.tableLastActivity")}</EnterpriseTableHeading>
              <EnterpriseTableHeading align="right">{t("projects.tableActions")}</EnterpriseTableHeading>
            </tr>
          </EnterpriseTableHead>

          <EnterpriseTableBody>
            {items.map((project) => (
              <EnterpriseTableRow key={project.id}>
                <EnterpriseTableCell>
                  <div className="flex items-start gap-3">
                    <ProjectAvatar name={project.projectName} />
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="truncate text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]"
                      >
                        {project.projectName}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{project.customerName}</p>
                    </div>
                  </div>
                </EnterpriseTableCell>

                <EnterpriseTableCell>{project.customerName}</EnterpriseTableCell>
                <EnterpriseTableCell>{project.projectManagerName}</EnterpriseTableCell>
                <EnterpriseTableCell>
                  <ProjectStatusBadge statusKey={project.statusKey} label={project.statusLabel} />
                </EnterpriseTableCell>
                <EnterpriseTableCell className="font-semibold">{project.budgetLabel}</EnterpriseTableCell>
                <EnterpriseTableCell>
                  <ProjectProgress value={project.progress} />
                </EnterpriseTableCell>
                <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{project.startDateLabel}</EnterpriseTableCell>
                <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{project.endDateLabel}</EnterpriseTableCell>
                <EnterpriseTableCell className="text-[var(--color-text-secondary)]">{project.lastActivityLabel}</EnterpriseTableCell>
                <EnterpriseTableCell align="right">
                  <ProjectActions
                    projectId={project.id}
                    viewLabel={t("projects.viewWorkspace")}
                    moreLabel={t("projects.actionsMore")}
                    comingSoonLabel={t("projects.comingSoon")}
                  />
                </EnterpriseTableCell>
              </EnterpriseTableRow>
            ))}
          </EnterpriseTableBody>
      </EnterpriseTable>
    </TableContainer>
  );
}
