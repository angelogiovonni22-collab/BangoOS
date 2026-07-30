import { Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import type { WorkspaceActivityItem, WorkspaceHealthItem, WorkspaceMilestoneItem } from "./types";
import { ProjectActivity } from "./project-activity";
import { ProjectBudget } from "./project-budget";
import { ProjectCrewSummary } from "./project-crew-summary";
import { ProjectHealth } from "./project-health";
import { ProjectMilestones } from "./project-milestones";

type ProjectOverviewProps = {
  healthItems: WorkspaceHealthItem[];
  overallHealth: string;
  recentActivity: WorkspaceActivityItem[];
  upcomingSchedule: WorkspaceMilestoneItem[];
  crewTitle: string;
  crewItems: import("@/lib/crews").ProjectCrewAssignmentSummary[];
  budgetTitle: string;
  budget: string;
  estimatedCost: string;
  profit: string;
  invoicesOutstanding: string;
  openIssues: WorkspaceMilestoneItem[];
  milestones: WorkspaceMilestoneItem[];
  dailyReports: WorkspaceActivityItem[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectOverview({
  healthItems,
  overallHealth,
  recentActivity,
  upcomingSchedule,
  crewTitle,
  crewItems,
  budgetTitle,
  budget,
  estimatedCost,
  profit,
  invoicesOutstanding,
  openIssues,
  milestones,
  dailyReports,
  t,
}: ProjectOverviewProps) {
  return (
    <div className="space-y-6">
      <ProjectHealth items={healthItems} overallHealth={overallHealth} t={t} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ProjectActivity title={t("projects.overviewRecentActivity")} items={recentActivity} emptyLabel={t("projects.workspaceNoActivity")} viewLabel={t("projects.workspaceViewDetails")} />
        <ProjectMilestones title={t("projects.overviewUpcomingSchedule")} items={upcomingSchedule} emptyLabel={t("projects.workspaceNoMilestones")} viewLabel={t("projects.workspaceViewDetails")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProjectCrewSummary title={crewTitle} items={crewItems} fallbackLabel={t("projects.workspaceNoCrew")} viewLabel={t("projects.workspaceViewTeam")} />
        <ProjectBudget title={budgetTitle} budget={budget} estimatedCost={estimatedCost} profit={profit} outstandingInvoices={invoicesOutstanding} t={t} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProjectMilestones title={t("projects.overviewMilestones")} items={milestones} emptyLabel={t("projects.workspaceNoMilestones")} viewLabel={t("projects.workspaceViewDetails")} />
        <ProjectActivity title={t("projects.overviewRecentDailyReports")} items={dailyReports} emptyLabel={t("projects.workspaceNoDailyReports")} viewLabel={t("projects.workspaceViewDetails")} />
      </div>

      <Card as="section" variant="elevated">
        <CardHeader className="bg-[var(--color-surface-subtle)]/50">
          <CardTitle>{t("projects.overviewOpenIssues")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {openIssues.length > 0 ? (
            openIssues.map((issue) => (
              <div key={issue.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{issue.title}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{issue.detail}</p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">{issue.dateLabel}</p>
              </div>
            ))
          ) : (
            <EmptyState compact icon="O" title={t("projects.overviewOpenIssuesEmptyTitle")} description={t("projects.overviewOpenIssuesEmptyDescription")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
