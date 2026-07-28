import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui";
import type { ProjectEvent } from "@/lib/project-intelligence/types";
import { ProjectTimelineEventDetails } from "./ProjectTimelineEventDetails";

type ProjectTimelineEventProps = {
  event: ProjectEvent;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  timelineIcon?: ReactNode;
};

export function ProjectTimelineEvent({ event, locale, t, timelineIcon }: ProjectTimelineEventProps) {
  const [expanded, setExpanded] = useState(false);

  const categoryLabel = t(categoryLabelKey(event.category));
  const sourceLabel = sourceDisplayLabel(event, t);

  const badges = useMemo(
    () => buildEventBadges(event, categoryLabel, t),
    [categoryLabel, event, t],
  );

  return (
    <article className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-border-strong)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {timelineIcon ? (
              <span className="sm:hidden" aria-hidden="true">
                {timelineIcon}
              </span>
            ) : null}

            {badges.map((badge) => (
              <Badge key={badge.id} tone={badge.tone}>{badge.label}</Badge>
            ))}
          </div>

          <h4 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">{translate(event.title, t)}</h4>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{shortText(translate(event.description, t))}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <span>{event.actor.name}</span>
            <span>•</span>
            <span>{formatRelativeTime(event.occurredAt, locale)}</span>
            <span>•</span>
            <span>{t("projects.intelligenceSourceLabel", { source: sourceLabel })}</span>
            <span>•</span>
            <span>{t("projects.intelligenceAttachmentCount", { count: event.attachments.length })}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
          aria-expanded={expanded}
          aria-label={expanded ? t("projects.intelligenceCollapse") : t("projects.intelligenceExpand")}
        >
          {expanded ? t("projects.intelligenceCollapse") : t("projects.intelligenceExpand")}
        </button>
      </div>

      {expanded ? <ProjectTimelineEventDetails event={event} locale={locale} t={t} sourceLabel={sourceLabel} /> : null}
    </article>
  );
}

function priorityTone(priority: ProjectEvent["priority"]): "neutral" | "warning" | "danger" {
  if (priority === "critical") {
    return "danger";
  }

  if (priority === "high") {
    return "warning";
  }

  return "neutral";
}

function priorityLabelKey(priority: ProjectEvent["priority"]) {
  return `projects.intelligencePriority${toTitle(priority)}`;
}

function categoryLabelKey(category: ProjectEvent["category"]) {
  if (category === "ai") {
    return "projects.intelligenceCategoryAI";
  }

  if (category === "daily_report") {
    return "projects.intelligenceCategoryDailyReport";
  }

  if (category === "change_order") {
    return "projects.intelligenceCategoryChangeOrder";
  }

  if (category === "sitecam") {
    return "projects.intelligenceCategorySiteCam";
  }

  return `projects.intelligenceCategory${toTitle(category)}`;
}

function buildEventBadges(
  event: ProjectEvent,
  categoryLabel: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const items: Array<{ id: string; label: string; tone: "neutral" | "warning" | "danger" | "info" }> = [
    {
      id: "category",
      label: categoryLabel,
      tone: "neutral",
    },
    {
      id: "priority",
      label: t(priorityLabelKey(event.priority)),
      tone: priorityTone(event.priority),
    },
  ];

  if (event.financialImpact) {
    items.push({ id: "financial", label: t("projects.intelligenceBadgeFinancial"), tone: "info" });
  }

  if (event.scheduleImpact) {
    items.push({ id: "schedule", label: t("projects.intelligenceBadgeSchedule"), tone: "warning" });
  }

  if (event.aiContext?.requiresAttention) {
    items.push({ id: "attention", label: t("projects.intelligenceBadgeAttention"), tone: "danger" });
  }

  return dedupeAdjacentBadgeLabels(items);
}

function dedupeAdjacentBadgeLabels<T extends { label: string }>(items: T[]) {
  return items.filter((item, index) => {
    if (index === 0) {
      return true;
    }

    return item.label.trim().toLowerCase() !== items[index - 1].label.trim().toLowerCase();
  });
}

function sourceDisplayLabel(
  event: ProjectEvent,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (event.source === "ai") {
    return event.actor.name;
  }

  return t(`projects.intelligenceSource${toTitle(event.source)}`);
}

function shortText(value: string) {
  if (value.length < 160) {
    return value;
  }

  return `${value.slice(0, 157)}...`;
}

function formatRelativeTime(value: string, locale: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function toTitle(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function translate(value: string, t: (key: string, params?: Record<string, string | number>) => string) {
  return value.includes(".") ? t(value) : value;
}
