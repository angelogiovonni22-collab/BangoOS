import Link from "next/link";
import { Badge } from "@/components/ui";
import type { ProjectEvent } from "@/lib/project-intelligence/types";

type ProjectTimelineEventDetailsProps = {
  event: ProjectEvent;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  sourceLabel: string;
};

export function ProjectTimelineEventDetails({ event, locale, t, sourceLabel }: ProjectTimelineEventDetailsProps) {
  return (
    <div className="mt-4 space-y-3 border-t border-[var(--color-border-subtle)] pt-4 text-sm text-[var(--color-text-secondary)]">
      <p>{translate(event.description, t)}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailRow label={t("projects.intelligenceDetailsSource")} value={sourceLabel} />
        <DetailRow label={t("projects.intelligenceDetailsOccurredAt")} value={formatTimestamp(event.occurredAt, locale)} />
      </div>

      {event.relatedEntity ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceDetailsRelatedEntity")}</p>
          {event.relatedEntity.href ? (
            <Link href={event.relatedEntity.href} className="mt-1 inline-block text-sm font-semibold text-[var(--color-brand-700)] hover:underline">
              {event.relatedEntity.label}
            </Link>
          ) : (
            <p className="mt-1 text-sm">{event.relatedEntity.label}</p>
          )}
        </div>
      ) : null}

      {event.attachments.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceDetailsAttachments")}</p>
          <ul className="mt-2 space-y-1">
            {event.attachments.map((attachment) => (
              <li key={attachment.id}>
                <a href={attachment.url} className="text-sm font-medium text-[var(--color-brand-700)] hover:underline">
                  {attachment.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {event.financialImpact ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceDetailsFinancialImpact")}</p>
          <p className="mt-1 font-semibold text-[var(--color-text-primary)]">
            {new Intl.NumberFormat(locale, { style: "currency", currency: event.financialImpact.currency, maximumFractionDigits: 0 }).format(event.financialImpact.amount)}
            {" "}
            {t(`projects.intelligenceImpactDirection${toTitle(event.financialImpact.direction)}`)}
          </p>
          <p className="mt-1 text-xs">{event.financialImpact.budgetCategory}</p>
        </div>
      ) : null}

      {event.scheduleImpact ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceDetailsScheduleImpact")}</p>
          <p className="mt-1 font-semibold text-[var(--color-text-primary)]">
            {t("projects.intelligenceScheduleImpactDelta", {
              delay: event.scheduleImpact.delayDays,
              recovered: event.scheduleImpact.recoveredDays,
            })}
          </p>
          <p className="mt-1 text-xs">{event.scheduleImpact.reason}</p>
        </div>
      ) : null}

      {event.aiContext ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("projects.intelligenceDetailsAIContext")}</p>
            {event.aiContext.requiresAttention ? <Badge tone="warning">{t("projects.intelligenceNeedsAttention")}</Badge> : null}
          </div>
          <p className="mt-1">{event.aiContext.summary}</p>

          {event.aiExplanation?.factors && event.aiExplanation.factors.length > 0 ? (
            <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {t("projects.intelligenceWhyThisMatters")}
              </p>

              {event.aiExplanation.summary ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{translate(event.aiExplanation.summary, t)}</p> : null}

              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
                {event.aiExplanation.factors.map((factor) => (
                  <li key={factor}>{translate(factor, t)}</li>
                ))}
              </ul>

              {event.aiExplanation.recommendedAction ? (
                <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                  <span className="font-semibold">{t("projects.intelligenceRecommendedActionLabel")}: </span>
                  {translate(event.aiExplanation.recommendedAction, t)}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="mt-2 text-xs">
            {t("projects.intelligenceConfidence", { value: Math.round(event.aiContext.confidence * 100) })}
          </p>
          <p className="mt-1 text-xs">{event.aiContext.riskSignals.join(", ")}</p>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{value}</p>
    </div>
  );
}

function translate(value: string, t: (key: string, params?: Record<string, string | number>) => string) {
  return value.includes(".") ? t(value) : value;
}

function formatTimestamp(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
