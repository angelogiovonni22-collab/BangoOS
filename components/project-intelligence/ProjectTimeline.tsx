"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, Card, CardContent, ErrorState, Input, Select } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { useProjectTimeline } from "@/lib/project-intelligence/use-project-timeline";
import type {
  NewManualProjectNoteInput,
  ProjectEventCategory,
  ProjectEventPriority,
  ProjectTimelineDateRange,
} from "@/lib/project-intelligence/types";
import { ProjectRiskSummary } from "./ProjectRiskSummary";
import { ProjectTimelineEmptyState } from "./ProjectTimelineEmptyState";
import { ProjectTimelineFilters } from "./ProjectTimelineFilters";
import { ProjectTimelineGroup } from "./ProjectTimelineGroup";
import { ProjectTimelineHeader } from "./ProjectTimelineHeader";
import { ProjectTimelineSearch } from "./ProjectTimelineSearch";
import { ProjectTimelineSkeleton } from "./ProjectTimelineSkeleton";
import { ProjectTimelineSummary } from "./ProjectTimelineSummary";

type ProjectTimelineProps = {
  projectId: string;
  localeTag: string;
  currentUserId: string;
  currentUserName: string;
};

type ManualNoteFormState = {
  title: string;
  note: string;
  category: ProjectEventCategory;
  priority: ProjectEventPriority;
  occurredAt: string;
  relatedEntityLabel: string;
  relatedEntityHref: string;
};

const initialFormState: ManualNoteFormState = {
  title: "",
  note: "",
  category: "project",
  priority: "normal",
  occurredAt: new Date().toISOString().slice(0, 10),
  relatedEntityLabel: "",
  relatedEntityHref: "",
};

const noteCategoryOptions: ProjectEventCategory[] = [
  "project",
  "customer",
  "schedule",
  "task",
  "inspection",
  "material",
  "change_order",
  "invoice",
  "budget",
  "ai",
];

const priorityOptions: ProjectEventPriority[] = ["low", "normal", "high", "critical"];

export function ProjectTimeline({ projectId, localeTag, currentUserId, currentUserName }: ProjectTimelineProps) {
  const { t } = useI18n();

  const [showFilters, setShowFilters] = useState(true);
  const [showManualNote, setShowManualNote] = useState(false);
  const [manualNoteError, setManualNoteError] = useState<string | null>(null);
  const [formState, setFormState] = useState<ManualNoteFormState>(initialFormState);

  const {
    isLoading,
    errorMessage,
    groupedEvents,
    summary,
    riskSummary,
    filters,
    searchTerm,
    matchedCount,
    activeFilterCount,
    setSearchTerm,
    setCategoryFilter,
    setPriorityFilter,
    setImpactFilter,
    setDateRangeFilter,
    clearFilters,
    addManualNote,
    refresh,
    isEmpty,
  } = useProjectTimeline({
    projectId,
    locale: localeTag,
    t,
    currentActor: {
      id: currentUserId,
      name: currentUserName,
      avatarUrl: null,
      role: t("projects.fieldProjectManager"),
      type: "employee",
    },
  });

  const rangeLabel = useMemo(() => {
    if (!summary.firstActivityAt || !summary.latestActivityAt) {
      return t("projects.notProvided");
    }

    const formatter = new Intl.DateTimeFormat(localeTag, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${formatter.format(new Date(summary.firstActivityAt))} - ${formatter.format(new Date(summary.latestActivityAt))}`;
  }, [localeTag, summary.firstActivityAt, summary.latestActivityAt, t]);

  const latestLabel = summary.latestActivityAt
    ? new Intl.DateTimeFormat(localeTag, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(summary.latestActivityAt))
    : t("projects.notProvided");

  const handleManualNoteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setManualNoteError(null);

    if (!formState.title.trim()) {
      setManualNoteError(t("projects.intelligenceValidationTitle"));
      return;
    }

    if (!formState.note.trim()) {
      setManualNoteError(t("projects.intelligenceValidationNote"));
      return;
    }

    if (!formState.occurredAt) {
      setManualNoteError(t("projects.intelligenceValidationOccurredAt"));
      return;
    }

    const input: NewManualProjectNoteInput = {
      title: formState.title,
      note: formState.note,
      category: formState.category,
      priority: formState.priority,
      occurredAt: `${formState.occurredAt}T12:00:00Z`,
      relatedEntity: formState.relatedEntityLabel.trim()
        ? {
            id: `manual-related-${Math.random().toString(36).slice(2, 8)}`,
            type: "note",
            label: formState.relatedEntityLabel.trim(),
            href: formState.relatedEntityHref.trim() || null,
          }
        : null,
    };

    addManualNote(input);
    setFormState(initialFormState);
    setShowManualNote(false);
  };

  if (isLoading) {
    return <ProjectTimelineSkeleton />;
  }

  if (errorMessage) {
    return <ErrorState title={t("projects.intelligenceErrorTitle")} description={errorMessage} />;
  }

  return (
    <div className="space-y-5">
      <ProjectTimelineHeader
        totalEvents={summary.totalEvents}
        dateRangeLabel={rangeLabel}
        latestActivityLabel={latestLabel}
        activeRiskCount={summary.openRisks}
        onSearch={() => {
          setShowFilters(true);
          document.getElementById("project-intelligence-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        onToggleFilters={() => setShowFilters((current) => !current)}
        onRefresh={refresh}
        onAddNote={() => setShowManualNote((current) => !current)}
        t={t}
      />

      <ProjectTimelineSummary summary={summary} locale={localeTag} t={t} />

      <div className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4">
        <div id="project-intelligence-search">
          <ProjectTimelineSearch value={searchTerm} onChange={setSearchTerm} matchedCount={matchedCount} t={t} />
        </div>

        {showFilters ? (
          <ProjectTimelineFilters
            category={filters.category}
            priority={filters.priority}
            impact={filters.impact}
            dateRange={filters.dateRange as ProjectTimelineDateRange}
            activeFilterCount={activeFilterCount}
            onCategoryChange={setCategoryFilter}
            onPriorityChange={setPriorityFilter}
            onImpactChange={setImpactFilter}
            onDateRangeChange={setDateRangeFilter}
            onClear={clearFilters}
            t={t}
          />
        ) : null}
      </div>

      {showManualNote ? (
        <Card>
          <CardContent className="space-y-4 p-5">
            <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("projects.intelligenceAddManualNote")}</h4>
            <form className="grid gap-3" onSubmit={handleManualNoteSubmit}>
              <Input
                value={formState.title}
                onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                placeholder={t("projects.intelligenceManualNoteTitlePlaceholder")}
                aria-label={t("projects.intelligenceManualNoteTitle")}
              />

              <textarea
                value={formState.note}
                onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))}
                placeholder={t("projects.intelligenceManualNoteBodyPlaceholder")}
                className="min-h-28 w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
                aria-label={t("projects.intelligenceManualNoteBody")}
              />

              <div className="grid gap-3 sm:grid-cols-4">
                <Select
                  value={formState.category}
                  onChange={(event) => setFormState((current) => ({ ...current, category: event.target.value as ProjectEventCategory }))}
                  aria-label={t("projects.intelligenceManualNoteCategory")}
                >
                  {noteCategoryOptions.map((option) => (
                    <option key={option} value={option}>{t(categoryKey(option))}</option>
                  ))}
                </Select>

                <Select
                  value={formState.priority}
                  onChange={(event) => setFormState((current) => ({ ...current, priority: event.target.value as ProjectEventPriority }))}
                  aria-label={t("projects.intelligenceManualNotePriority")}
                >
                  {priorityOptions.map((option) => (
                    <option key={option} value={option}>{t(`projects.intelligencePriority${toTitle(option)}`)}</option>
                  ))}
                </Select>

                <Input
                  type="date"
                  value={formState.occurredAt}
                  onChange={(event) => setFormState((current) => ({ ...current, occurredAt: event.target.value }))}
                  aria-label={t("projects.intelligenceManualNoteOccurredAt")}
                />

                <Input
                  value={formState.relatedEntityLabel}
                  onChange={(event) => setFormState((current) => ({ ...current, relatedEntityLabel: event.target.value }))}
                  placeholder={t("projects.intelligenceManualNoteRelatedEntityPlaceholder")}
                  aria-label={t("projects.intelligenceManualNoteRelatedEntity")}
                />
              </div>

              <Input
                value={formState.relatedEntityHref}
                onChange={(event) => setFormState((current) => ({ ...current, relatedEntityHref: event.target.value }))}
                placeholder={t("projects.intelligenceManualNoteRelatedLinkPlaceholder")}
                aria-label={t("projects.intelligenceManualNoteRelatedLink")}
              />

              {manualNoteError ? (
                <p className="text-sm text-[var(--color-danger-700)]">{manualNoteError}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="submit">{t("projects.intelligenceSaveNote")}</Button>
                <Button type="button" variant="outline" onClick={() => setShowManualNote(false)}>
                  {t("projects.cancel")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          {isEmpty || groupedEvents.length === 0 ? (
            <ProjectTimelineEmptyState
              title={t("projects.intelligenceEmptyTitle")}
              description={t("projects.intelligenceEmptyDescription")}
            />
          ) : (
            groupedEvents.map((group) => (
              <ProjectTimelineGroup key={group.key} group={group} locale={localeTag} t={t} />
            ))
          )}
        </div>

        <div className="xl:sticky xl:top-4 xl:self-start">
          <ProjectRiskSummary risks={riskSummary} locale={localeTag} t={t} />
        </div>
      </section>
    </div>
  );
}

function toTitle(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function categoryKey(category: ProjectEventCategory) {
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
