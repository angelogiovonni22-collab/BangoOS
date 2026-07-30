import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import Link from "next/link";
import type { WorkspaceActivityItem, WorkspaceContactItem, WorkspaceMilestoneItem, WorkspaceQuickAction } from "./types";
import { ProjectActivity } from "./project-activity";
import { ProjectMilestones } from "./project-milestones";

type ProjectSidebarProps = {
  contacts: WorkspaceContactItem[];
  quickActions: WorkspaceQuickAction[];
  milestones: WorkspaceMilestoneItem[];
  activity: WorkspaceActivityItem[];
  aiSummary: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectSidebar({ contacts, quickActions, milestones, activity, aiSummary, t }: ProjectSidebarProps) {
  return (
    <aside className="hidden xl:block xl:space-y-3.5">
      <Card as="section" className="shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/35">
          <CardTitle>{t("projects.workspaceProjectContacts")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 p-4">
          {contacts.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
              {t("projects.workspaceNoContacts")}
            </p>
          ) : (
            contacts.map((contact) => (
              <div key={contact.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/55 p-3.5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{contact.label}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{contact.value}</p>
                {contact.role ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{contact.role}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card as="section" className="shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/35">
          <CardTitle>{t("projects.workspaceQuickActions")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {quickActions.map((action) => {
            if (action.href && !action.disabled) {
              return (
                <Link key={action.id} href={action.href}>
                  <Button variant="toolbar" fullWidth>
                    {action.label}
                  </Button>
                </Link>
              );
            }

            return (
              <Button
                key={action.id}
                variant="toolbar"
                fullWidth
                disabled={action.disabled}
                aria-disabled={action.disabled ? "true" : undefined}
                title={action.title}
              >
                {action.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <ProjectMilestones title={t("projects.workspaceUpcomingMilestones")} items={milestones} emptyLabel={t("projects.workspaceNoMilestones")} viewLabel={t("projects.workspaceViewDetails")} />

      <ProjectActivity title={t("projects.workspaceRecentActivity")} items={activity} emptyLabel={t("projects.workspaceNoActivity")} viewLabel={t("projects.workspaceViewDetails")} />

      <Card as="section" className="shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/35">
          <CardTitle>{t("projects.workspaceAiSummary")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {aiSummary}
          </p>
        </CardContent>
      </Card>
    </aside>
  );
}
