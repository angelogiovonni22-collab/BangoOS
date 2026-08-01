import Link from "next/link";
import {
  Activity,
  CalendarClock,
  ClipboardList,
  DollarSign,
  Flag,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui";
import type { ProjectHealthResult } from "./project-health-calculator";
import type { WorkspaceActivityItem, WorkspaceMilestoneItem } from "./types";

type ProjectOverviewProps = {
  details: Array<{
    label: string;
    value: string;
    href?: string;
    badgeTone?: "brand" | "success" | "warning" | "danger" | "neutral" | "info";
  }>;
  description: string;
  health: ProjectHealthResult;
  budgetLabel: string;
  spentLabel: string;
  remainingLabel: string;
  profitMarginLabel: string;
  recentActivity: WorkspaceActivityItem[];
  upcomingDates: WorkspaceMilestoneItem[];
};

export function ProjectOverview({
  details,
  description,
  health,
  budgetLabel,
  spentLabel,
  remainingLabel,
  profitMarginLabel,
  recentActivity,
  upcomingDates,
}: ProjectOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
          <CardHeader className="bg-[var(--color-surface-subtle)]/55">
            <SectionHeader
              icon={<ClipboardList size={16} aria-hidden="true" />}
              iconClass="bg-[var(--color-primary-100)] text-[var(--color-brand-700)]"
              title="Project Details"
            />
          </CardHeader>

          <CardContent className="p-0">
            <dl>
              {details.map((item, index) => (
                <div
                  key={item.label}
                  className={`grid gap-2 px-5 py-3.5 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-center ${index < details.length - 1 ? "border-b border-[var(--color-border-subtle)]" : ""}`}
                >
                  <dt className="text-sm font-semibold text-[var(--color-text-secondary)]">{item.label}</dt>
                  <dd className="text-sm font-semibold text-[var(--color-navy-900)] sm:text-right">
                    {item.badgeTone ? (
                      <Badge tone={item.badgeTone}>{item.value}</Badge>
                    ) : item.href ? (
                      <Link href={item.href} className="text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                        {item.value}
                      </Link>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="border-t border-[var(--color-border-subtle)] p-5">
              <div className="rounded-[14px] border border-[var(--color-primary-100)] bg-[linear-gradient(180deg,rgba(37,99,235,0.1),rgba(255,255,255,0.95))] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-700)]">Scope</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
          <CardHeader className="bg-[var(--color-surface-subtle)]/55">
            <SectionHeader
              icon={<ShieldCheck size={16} aria-hidden="true" />}
              iconClass="bg-[var(--color-success-100)] text-[var(--color-success-700)]"
              title="Project Health"
            />
          </CardHeader>

          <CardContent className="space-y-3 p-5">
            <CompactHealthRow label="Health" value={health.statusLabel} tone={health.tone} />
            <CompactHealthRow label="Progress" value={health.progressLabel} tone={toneFromText(health.progressLabel)} />
            <CompactHealthRow label="Schedule" value={health.scheduleCondition} tone={toneFromText(health.scheduleCondition)} />
            <CompactHealthRow label="Financial" value={health.budgetCondition} tone={toneFromText(health.budgetCondition)} />
            <CompactHealthRow label="Due Date" value={health.dueDateCondition} tone={toneFromText(health.dueDateCondition)} />

            <div className="rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{health.summary}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <SectionHeader
            icon={<DollarSign size={16} aria-hidden="true" />}
            iconClass="bg-[var(--color-analytics-100)] text-[var(--color-analytics-700)]"
            title="Financial Snapshot"
          />
        </CardHeader>

        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <SnapshotTile label="Budget" value={budgetLabel} tone="brand" />
          <SnapshotTile label="Spent" value={spentLabel} tone="warning" />
          <SnapshotTile label="Remaining" value={remainingLabel} tone="info" />
          <SnapshotTile label="Profit Margin" value={profitMarginLabel} tone="success" />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
          <CardHeader className="bg-[var(--color-surface-subtle)]/55">
            <SectionHeader
              icon={<Activity size={16} aria-hidden="true" />}
              iconClass="bg-[var(--color-analytics-100)] text-[var(--color-analytics-700)]"
              title="Recent Activity"
            />
          </CardHeader>

          <CardContent className="p-5">
            {recentActivity.length === 0 ? (
              <EmptyState
                compact
                icon="R"
                title="No recent activity"
                description="Activity from tasks, invoices, and related records will appear here once events are logged."
              />
            ) : (
              <ul className="space-y-4">
                {recentActivity.map((item, index) => (
                  <li key={item.id} className="relative pl-10">
                    {index < recentActivity.length - 1 ? (
                      <span className="absolute left-[15px] top-7 h-[calc(100%+8px)] w-px bg-[var(--color-border-subtle)]" aria-hidden="true" />
                    ) : null}
                    <span className={`absolute left-0 top-0 inline-flex h-[30px] w-[30px] items-center justify-center rounded-full ${toneDotClass(item.tone)}`}>
                      <Activity size={14} aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--color-navy-900)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.detail}</p>
                    <p className="mt-1.5 text-xs font-medium text-[var(--color-text-muted)]">{item.timestamp}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
          <CardHeader className="bg-[var(--color-surface-subtle)]/55">
            <SectionHeader
              icon={<CalendarClock size={16} aria-hidden="true" />}
              iconClass="bg-[var(--color-warning-100)] text-[var(--color-warning-700)]"
              title="Upcoming Dates"
            />
          </CardHeader>

          <CardContent className="p-5">
            {upcomingDates.length === 0 ? (
              <EmptyState
                compact
                icon="U"
                title="No upcoming dates"
                description="Milestones, due dates, and scheduled events will appear here when they are available."
              />
            ) : (
              <ul className="space-y-4">
                {upcomingDates.map((item, index) => (
                  <li key={item.id} className="relative pl-10">
                    {index < upcomingDates.length - 1 ? (
                      <span className="absolute left-[15px] top-7 h-[calc(100%+8px)] w-px bg-[var(--color-warning-200)]" aria-hidden="true" />
                    ) : null}
                    <span className="absolute left-0 top-0 inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--color-warning-100)] text-[var(--color-warning-700)]">
                      <Flag size={14} aria-hidden="true" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--color-navy-900)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.detail}</p>
                    <p className="mt-1.5 text-xs font-medium text-[var(--color-text-muted)]">{item.dateLabel}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SectionHeader({ icon, iconClass, title }: { icon: ReactNode; iconClass: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] ${iconClass}`}>{icon}</span>
      <CardTitle className="text-[1.18rem] font-bold text-[var(--color-navy-900)]">{title}</CardTitle>
    </div>
  );
}

function CompactHealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "success" | "warning" | "danger" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--color-border-subtle)] bg-white px-4 py-3">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function SnapshotTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "success" | "warning" | "info";
}) {
  const classMap = {
    brand: "border-[var(--color-primary-100)] bg-[linear-gradient(180deg,rgba(37,99,235,0.12),rgba(255,255,255,1))]",
    warning: "border-[var(--color-warning-200)] bg-[linear-gradient(180deg,rgba(249,115,22,0.12),rgba(255,255,255,1))]",
    info: "border-[var(--color-info-100)] bg-[linear-gradient(180deg,rgba(20,184,166,0.12),rgba(255,255,255,1))]",
    success: "border-[var(--color-success-100)] bg-[linear-gradient(180deg,rgba(34,197,94,0.12),rgba(255,255,255,1))]",
  }[tone];

  return (
    <div className={`rounded-[12px] border p-4 shadow-[var(--shadow-small)] ${classMap}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1.5 text-[1.35rem] font-bold text-[var(--color-navy-900)]">{value}</p>
    </div>
  );
}

function toneDotClass(tone: WorkspaceActivityItem["tone"] | WorkspaceMilestoneItem["tone"]) {
  const toneMap: Record<string, string> = {
    blue: "bg-[var(--color-primary-100)] text-[var(--color-brand-700)]",
    green: "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
    amber: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]",
    indigo: "bg-[var(--color-info-100)] text-[var(--color-info-700)]",
    analytics: "bg-[var(--color-analytics-100)] text-[var(--color-analytics-700)]",
    slate: "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]",
    danger: "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]",
  };

  return toneMap[tone] || toneMap.slate;
}

function toneFromText(value: string): "brand" | "success" | "warning" | "danger" | "neutral" {
  const normalized = value.toLowerCase();

  if (normalized.includes("overdue") || normalized.includes("late") || normalized.includes("over budget")) {
    return "danger";
  }

  if (normalized.includes("risk") || normalized.includes("near") || normalized.includes("compressed")) {
    return "warning";
  }

  if (normalized.includes("within") || normalized.includes("steady") || normalized.includes("complete")) {
    return "success";
  }

  if (normalized.includes("unavailable") || normalized.includes("missing") || normalized.includes("limited")) {
    return "neutral";
  }

  return "brand";
}
