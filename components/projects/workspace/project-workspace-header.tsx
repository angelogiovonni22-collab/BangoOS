"use client";

import { Ellipsis, ExternalLink, Share2, PencilLine } from "lucide-react";
import { Button, Card, CardContent, IconButton, PageHeader, StatusBadge } from "@/components/ui";
import { ProjectAvatar } from "../project-avatar";

type ProjectWorkspaceHeaderProps = {
  projectName: string;
  customerName: string;
  statusKey: string;
  statusLabel: string;
  projectManager: string;
  location: string;
  startDate: string;
  estimatedCompletion: string;
  budget: string;
  progress: number;
  editDisabledLabel: string;
  shareLabel: string;
  moreLabel: string;
  comingSoonLabel: string;
  onShare: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectWorkspaceHeader({
  projectName,
  customerName,
  statusKey,
  statusLabel,
  projectManager,
  location,
  startDate,
  estimatedCompletion,
  budget,
  progress,
  editDisabledLabel,
  shareLabel,
  moreLabel,
  comingSoonLabel,
  onShare,
  t,
}: ProjectWorkspaceHeaderProps) {
  return (
    <Card as="section" variant="elevated" className="shadow-[var(--shadow-small)]">
      <CardContent className="space-y-6 p-6 sm:space-y-7 sm:p-7">
        <div className="flex items-start gap-4">
          <ProjectAvatar name={projectName} className="h-14 w-14 text-base" />
          <div className="min-w-0 flex-1">
            <PageHeader
              eyebrow={t("projects.headerEyebrow")}
              title={projectName}
              description={customerName}
              secondaryActions={(
                <>
                  <Button variant="secondary" disabled aria-disabled="true" title={editDisabledLabel}>
                    <PencilLine size={16} aria-hidden="true" />
                    {t("projects.workspaceEditProject")}
                  </Button>
                  <Button variant="toolbar" disabled aria-disabled="true" title={comingSoonLabel}>
                    <ExternalLink size={16} aria-hidden="true" />
                    {t("projects.workspaceMore")}
                  </Button>
                </>
              )}
              primaryAction={(
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={onShare}>
                    <Share2 size={16} aria-hidden="true" />
                    {shareLabel}
                  </Button>
                  <IconButton
                    icon={<Ellipsis size={16} aria-hidden="true" />}
                    label={moreLabel}
                    variant="ghost"
                    size="sm"
                    disabled
                    aria-disabled="true"
                    title={comingSoonLabel}
                  />
                </div>
              )}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={statusKey || statusLabel} className="capitalize" />
          <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
            {projectManager}
          </span>
          <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
            {location}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <HeaderStat label={t("projects.workspaceStartDate")} value={startDate} />
          <HeaderStat label={t("projects.workspaceEstimatedCompletion")} value={estimatedCompletion} />
          <HeaderStat label={t("projects.workspaceBudget")} value={budget} />
          <HeaderStat label={t("projects.workspaceProgress")} value={`${Math.max(0, Math.min(100, Math.round(progress)))}%`} />
          <HeaderStat label={t("projects.workspaceCustomer")} value={customerName} />
        </div>
      </CardContent>
    </Card>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-row)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
