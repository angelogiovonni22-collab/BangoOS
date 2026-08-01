import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleUserRound,
  MoreHorizontal,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, Card, CardContent, getButtonClassName } from "@/components/ui";
import { AnimatedProgress, CountUp } from "@/components/motion";

type ProjectWorkspaceHeaderProps = {
  projectName: string;
  customerName: string;
  customerHref: string | null;
  customerProjectsHref: string;
  statusLabel: string;
  statusKey: string;
  projectTypeLabel: string;
  projectNumber: string | null;
  address: string;
  projectManager: string;
  startDate: string;
  targetCompletionDate: string;
  progressPercent: number;
  newDailyReportHref: string;
  newInvoiceHref: string;
  newChangeOrderHref: string;
  editProjectHref?: string | null;
};

export function ProjectWorkspaceHeader({
  projectName,
  customerName,
  customerHref,
  customerProjectsHref,
  statusLabel,
  statusKey,
  projectTypeLabel,
  projectNumber,
  address,
  projectManager,
  startDate,
  targetCompletionDate,
  progressPercent,
  newDailyReportHref,
  newInvoiceHref,
  newChangeOrderHref,
  editProjectHref,
}: ProjectWorkspaceHeaderProps) {
  const normalizedProgress = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <Card as="section" variant="elevated" className="overflow-hidden rounded-[18px] border-[var(--color-border-subtle)] shadow-[0_20px_42px_-28px_rgba(15,23,42,0.35)]">
      <CardContent className="space-y-6 bg-[linear-gradient(145deg,rgba(37,99,235,0.14),rgba(255,255,255,1)_40%,rgba(14,165,233,0.09)_100%)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={customerProjectsHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            View Customer Projects
          </Link>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {editProjectHref ? (
              <Link href={editProjectHref} className={getButtonClassName({ variant: "outline", size: "sm" })}>
                Edit Project
              </Link>
            ) : null}

            <Link href={newDailyReportHref} className={getButtonClassName({ variant: "outline", size: "sm" })}>
              Add Daily Report
            </Link>

            <details className="group relative">
              <summary className="list-none">
                <Button size="sm" variant="primary" aria-label="More Actions" className="shadow-[0_8px_18px_-12px_rgba(37,99,235,0.7)]">
                  <MoreHorizontal size={16} aria-hidden="true" />
                  More Actions
                  <ChevronDown size={14} aria-hidden="true" />
                </Button>
              </summary>
              <div className="absolute right-0 z-[var(--z-overlay)] mt-2 min-w-[210px] rounded-[12px] border border-[var(--color-border-subtle)] bg-white p-1.5 shadow-[0_16px_32px_-16px_rgba(15,23,42,0.35)]">
                <Link
                  href={newInvoiceHref}
                  className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]"
                >
                  <ReceiptText size={15} aria-hidden="true" />
                  New Invoice
                </Link>
                <Link
                  href={newChangeOrderHref}
                  className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]"
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  New Change Order
                </Link>
              </div>
            </details>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.95rem] font-bold leading-tight tracking-[-0.02em] text-[var(--color-navy-900)] sm:text-[2.15rem]">{projectName}</h1>
            <span className={`inline-flex items-center gap-2 text-sm font-semibold ${statusToneClass(statusKey)}`}>
              <span className="h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
              {statusLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-base">
            <span className="font-medium text-[var(--color-text-secondary)]">Customer:</span>
            {customerHref ? (
              <Link href={customerHref} className="font-semibold text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">
                {customerName}
              </Link>
            ) : (
              <span className="font-semibold text-[var(--color-text-primary)]">{customerName}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="info">{projectTypeLabel}</Badge>
            {projectNumber ? <Badge tone="brand">Project #{projectNumber}</Badge> : null}
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Project summary widgets">
          <SummaryWidget
            icon={<Building2 size={16} aria-hidden="true" />}
            iconClass="bg-[var(--color-primary-100)] text-[var(--color-brand-700)]"
            label="Address"
            value={address}
            backgroundClass="bg-[linear-gradient(180deg,rgba(37,99,235,0.1),rgba(255,255,255,1))]"
          />
          <SummaryWidget
            icon={<CircleUserRound size={16} aria-hidden="true" />}
            iconClass="bg-[var(--color-primary-100)] text-[var(--color-brand-700)]"
            label="Project Manager"
            value={projectManager}
            backgroundClass="bg-[linear-gradient(180deg,rgba(37,99,235,0.11),rgba(255,255,255,1))]"
          />
          <SummaryWidget
            icon={<CalendarDays size={16} aria-hidden="true" />}
            iconClass="bg-[var(--color-info-100)] text-[var(--color-info-700)]"
            label="Start Date"
            value={startDate}
            backgroundClass="bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(255,255,255,1))]"
          />
          <SummaryWidget
            icon={<CalendarCheck2 size={16} aria-hidden="true" />}
            iconClass="bg-[var(--color-warning-100)] text-[var(--color-warning-700)]"
            label="Target Completion"
            value={targetCompletionDate}
            backgroundClass="bg-[linear-gradient(180deg,rgba(249,115,22,0.13),rgba(255,255,255,1))]"
          />
          <ProgressWidget progress={normalizedProgress} />
        </section>
      </CardContent>
    </Card>
  );
}

function SummaryWidget({
  icon,
  iconClass,
  label,
  value,
  backgroundClass,
}: {
  icon: ReactNode;
  iconClass: string;
  label: string;
  value: string;
  backgroundClass: string;
}) {
  return (
    <article className={`min-h-[126px] rounded-[16px] border border-[var(--color-border-subtle)] p-4 shadow-[var(--shadow-small)] ${backgroundClass}`}>
      <div className="flex items-start gap-3">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconClass}`}>{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
          <p className="mt-1.5 break-words text-[0.95rem] font-bold leading-snug text-[var(--color-navy-900)]">{value}</p>
        </div>
      </div>
    </article>
  );
}

function ProgressWidget({ progress }: { progress: number }) {
  return (
    <article className="min-h-[126px] rounded-[16px] border border-[var(--color-primary-100)] bg-[linear-gradient(180deg,rgba(37,99,235,0.14),rgba(255,255,255,1))] p-4 shadow-[var(--shadow-small)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-[var(--color-brand-700)]">
          <ChartNoAxesCombined size={16} aria-hidden="true" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Progress</p>
          <p className="mt-1 text-[1.15rem] font-bold text-[var(--color-navy-900)]">
            <CountUp value={progress} durationMs={260} />%
          </p>
        </div>
      </div>

      <AnimatedProgress
        value={progress}
        className="mt-4 h-2.5"
        trackClassName="bg-[rgba(15,23,42,0.08)]"
        fillClassName="bg-[linear-gradient(90deg,var(--color-brand-700),var(--color-info-700))]"
        durationMs={240}
      />
    </article>
  );
}

function statusToneClass(statusKey: string) {
  const tones: Record<string, string> = {
    lead: "text-[var(--color-neutral-700)]",
    estimating: "text-[var(--color-warning-700)]",
    approved: "text-[var(--color-success-700)]",
    scheduled: "text-[var(--color-brand-700)]",
    in_progress: "text-[var(--color-success-700)]",
    on_hold: "text-[var(--color-warning-700)]",
    completed: "text-[var(--color-success-700)]",
    cancelled: "text-[var(--color-danger-700)]",
  };

  return tones[statusKey] || "text-[var(--color-neutral-700)]";
}
