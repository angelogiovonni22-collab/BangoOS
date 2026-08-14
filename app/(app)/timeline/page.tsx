"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Input, Select, SkeletonLoader } from "@/components/ui";
import { createOrionTimelineService, formatTimelineOccurredAt, formatTimelineText, type OrionTimelineCategory, type OrionTimelineCursor, type OrionTimelineItem, type OrionTimelineSeverity } from "@/lib/orion/timeline";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type Filters = {
  category: "all" | OrionTimelineCategory;
  severity: "all" | OrionTimelineSeverity;
  searchText: string;
};

const PAGE_SIZE = 20;

const INITIAL_FILTERS: Filters = {
  category: "all",
  severity: "all",
  searchText: "",
};

export default function TimelinePage() {
  const { t, locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<OrionTimelineItem[]>([]);
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [nextCursor, setNextCursor] = useState<OrionTimelineCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // cursor is passed explicitly on append calls so that nextCursor state does not
  // appear in the useCallback dependency array.  Including nextCursor there caused
  // a render loop: every fetch updated nextCursor → re-created loadTimeline →
  // re-fired the useEffect → fetched again, indefinitely.
  const loadTimeline = useCallback(async (mode: "replace" | "append", cursor?: OrionTimelineCursor | null) => {
    if (!supabase) {
      setErrorMessage(t("common.errorGeneric"));
      setIsLoading(false);
      return;
    }

    if (mode === "replace") {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    setErrorMessage(null);

    try {
      const workspace = await resolveWorkspaceContext(supabase);
      if (workspace.errorMessage || !workspace.context) {
        setErrorMessage(workspace.errorMessage || t("orion.timeline.loadError"));
        return;
      }

      const service = createOrionTimelineService(supabase);
      const result = await service.listCompanyTimeline(workspace.context.companyId, {
        pageSize: PAGE_SIZE,
        cursor: mode === "append" ? cursor || undefined : undefined,
        categories: filters.category === "all" ? undefined : [filters.category],
        severities: filters.severity === "all" ? undefined : [filters.severity],
        searchText: filters.searchText || undefined,
        includeLegacyAdapters: true,
      });

      if (mode === "append") {
        setItems((current) => [...current, ...result.items]);
      } else {
        setItems(result.items);
      }

      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("orion.timeline.loadError"));
    } finally {
      if (mode === "replace") {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [filters.category, filters.searchText, filters.severity, supabase, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTimeline("replace");
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadTimeline]);

  const grouped = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    const buckets: Record<"today" | "yesterday" | "earlier", OrionTimelineItem[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };

    for (const item of items) {
      const day = item.occurredAt.slice(0, 10);
      if (day === today) {
        buckets.today.push(item);
        continue;
      }

      if (day === yesterday) {
        buckets.yesterday.push(item);
        continue;
      }

      buckets.earlier.push(item);
    }

    return buckets;
  }, [items]);

  if (isLoading) {
    return <TimelineLoadingState />;
  }

  if (errorMessage) {
    return <ErrorState title={t("orion.timeline.loadErrorTitle")} description={errorMessage} />;
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium text-slate-500">{t("orion.timeline.eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t("orion.timeline.title")}</h1>
        <p className="mt-2 text-slate-600">{t("orion.timeline.description")}</p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            value={filters.searchText}
            onChange={(event) => setFilters((current) => ({ ...current, searchText: event.target.value }))}
            placeholder={t("orion.timeline.searchPlaceholder")}
            aria-label={t("orion.timeline.searchPlaceholder")}
          />
          <Select
            value={filters.category}
            onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as Filters["category"] }))}
            aria-label={t("orion.timeline.filterCategory")}
          >
            <option value="all">{t("orion.timeline.filterAllCategories")}</option>
            <option value="customers">{t("orion.timeline.category.customers")}</option>
            <option value="sales">{t("orion.timeline.category.sales")}</option>
            <option value="projects">{t("orion.timeline.category.projects")}</option>
            <option value="finance">{t("orion.timeline.category.finance")}</option>
            <option value="workforce">{t("orion.timeline.category.workforce")}</option>
            <option value="scheduling">{t("orion.timeline.category.scheduling")}</option>
            <option value="field">{t("orion.timeline.category.field")}</option>
            <option value="safety">{t("orion.timeline.category.safety")}</option>
            <option value="system">{t("orion.timeline.category.system")}</option>
          </Select>
          <Select
            value={filters.severity}
            onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value as Filters["severity"] }))}
            aria-label={t("orion.timeline.filterSeverity")}
          >
            <option value="all">{t("orion.timeline.filterAllSeverities")}</option>
            <option value="info">{t("orion.timeline.severity.info")}</option>
            <option value="success">{t("orion.timeline.severity.success")}</option>
            <option value="attention">{t("orion.timeline.severity.attention")}</option>
            <option value="warning">{t("orion.timeline.severity.warning")}</option>
            <option value="critical">{t("orion.timeline.severity.critical")}</option>
          </Select>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t("orion.timeline.resultCount", { count: items.length })}</p>
          <Button type="button" variant="outline" onClick={() => void loadTimeline("replace")}>
            {t("orion.timeline.refresh")}
          </Button>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState
          compact
          icon="T"
          title={t("orion.timeline.emptyTitle")}
          description={t("orion.timeline.emptyDescription")}
        />
      ) : (
        <div className="space-y-5">
          <TimelineGroup label={t("orion.timeline.group.today")} items={grouped.today} localeTag={localeTag} t={t} />
          <TimelineGroup label={t("orion.timeline.group.yesterday")} items={grouped.yesterday} localeTag={localeTag} t={t} />
          <TimelineGroup label={t("orion.timeline.group.earlier")} items={grouped.earlier} localeTag={localeTag} t={t} />
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" disabled={isLoadingMore} onClick={() => void loadTimeline("append", nextCursor)}>
            {isLoadingMore ? t("orion.timeline.loadingMore") : t("orion.timeline.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TimelineGroup({
  label,
  items,
  localeTag,
  t,
}: {
  label: string;
  items: OrionTimelineItem[];
  localeTag: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-label={label} className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</h2>
      <div className="space-y-3">
        {items.map((item) => {
          const text = formatTimelineText(item, t);
          return (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={badgeTone(item.severity)}>{t(`orion.timeline.severity.${item.severity}`)}</Badge>
                <span className="text-xs text-slate-500">{t(`orion.timeline.category.${item.category}`)}</span>
                <span className="text-xs text-slate-500">{t("orion.timeline.source", { value: item.sourceModule })}</span>
              </div>

              <h3 className="mt-2 text-base font-semibold text-slate-950">{text.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text.summary}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span>{formatTimelineOccurredAt(item.occurredAt, localeTag)}</span>
                {item.actorName ? <span>{t("orion.timeline.actor", { value: item.actorName })}</span> : null}
                {item.projectName ? <span>{t("orion.timeline.project", { value: item.projectName })}</span> : null}
                {item.customerName ? <span>{t("orion.timeline.customer", { value: item.customerName })}</span> : null}
              </div>

              {item.href ? (
                <div className="mt-3">
                  <Link href={item.href} className="text-sm font-semibold text-blue-700 hover:underline">
                    {t("orion.timeline.openRecord")}
                  </Link>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function badgeTone(severity: OrionTimelineSeverity): "neutral" | "warning" | "danger" | "success" | "info" {
  if (severity === "critical") {
    return "danger";
  }

  if (severity === "warning" || severity === "attention") {
    return "warning";
  }

  if (severity === "success") {
    return "success";
  }

  if (severity === "info") {
    return "info";
  }

  return "neutral";
}

function TimelineLoadingState() {
  return (
    <div className="space-y-4">
      <SkeletonLoader className="h-24 w-full" />
      <SkeletonLoader className="h-24 w-full" />
      <SkeletonLoader className="h-24 w-full" />
    </div>
  );
}
