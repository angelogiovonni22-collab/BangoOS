"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Activity, Camera, CheckCircle2, ClipboardList, DollarSign, FileText, Search } from "lucide-react";
import { FadeIn, StatusPulse } from "@/components/motion";
import { Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, Input, Select, SkeletonLoader } from "@/components/ui";
import { collectNewEntityIds, hasAnimatedEntries } from "@/lib/motion/replay-helpers";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

const STORAGE_BUCKET = "project-photos";

type WorkTaskSummary = {
  id: string;
  title: string;
  phase_id: string | null;
  status: string;
  assigned_profile_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  actual_finish: string | null;
};

type TimelineFilter = "all" | "tasks" | "photos" | "financial" | "daily_logs" | "inspections";

type TimelineSort = "newest" | "oldest";

type TimelineEvent = {
  id: string;
  filter: Exclude<TimelineFilter, "all">;
  eventType: "task_created" | "task_updated" | "task_completed" | "photo_uploaded" | "change_order_created" | "invoice_sent" | "estimate_approved";
  title: string;
  description: string;
  occurredAt: string;
  userName: string;
  phaseName: string | null;
  taskName: string | null;
  href: string | null;
  thumbnailUrl: string | null;
};

type ProjectPhotoRow = Pick<Database["public"]["Tables"]["project_photos"]["Row"], "id" | "created_at" | "note" | "uploaded_by" | "storage_path">;
type ChangeOrderRow = Pick<Database["public"]["Tables"]["change_orders"]["Row"], "id" | "title" | "change_order_number" | "created_at" | "created_by">;
type InvoiceRow = Pick<Database["public"]["Tables"]["invoices"]["Row"], "id" | "title" | "invoice_number" | "sent_at" | "created_by">;
type EstimateRow = Pick<Database["public"]["Tables"]["estimates"]["Row"], "id" | "title" | "estimate_number" | "status" | "updated_at" | "updated_by">;

type ProjectWorkOperationsTimelineProps = {
  companyId: string;
  projectId: string;
  tasks: WorkTaskSummary[];
  profiles: Record<string, string>;
  phaseNameById: Record<string, string>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectWorkOperationsTimeline({
  companyId,
  projectId,
  tasks,
  profiles,
  phaseNameById,
  t,
}: ProjectWorkOperationsTimelineProps) {
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [sort, setSort] = useState<TimelineSort>("newest");
  const [searchTerm, setSearchTerm] = useState("");

  const [photoEvents, setPhotoEvents] = useState<TimelineEvent[]>([]);
  const [financialEvents, setFinancialEvents] = useState<TimelineEvent[]>([]);
  const [newEventIds, setNewEventIds] = useState<Record<string, true>>({});
  const knownEventIdsRef = useRef<Set<string>>(new Set());

  const taskEvents = useMemo(() => {
    const next: TimelineEvent[] = [];

    tasks.forEach((task) => {
      const phaseName = task.phase_id ? phaseNameById[task.phase_id] || null : null;
      const createdBy = task.created_by ? profiles[task.created_by] || t("projects.notAssigned") : task.assigned_profile_id ? profiles[task.assigned_profile_id] || t("projects.notAssigned") : t("projects.notAssigned");

      next.push({
        id: `task-created-${task.id}`,
        filter: "tasks",
        eventType: "task_created",
        title: t("projects.workTimelineTaskCreatedTitle", { task: task.title }),
        description: t("projects.workTimelineTaskCreatedDescription"),
        occurredAt: task.created_at,
        userName: createdBy,
        phaseName,
        taskName: task.title,
        href: `/projects/${projectId}?tab=tasks`,
        thumbnailUrl: null,
      });

      const createdAtMs = new Date(task.created_at).getTime();
      const updatedAtMs = new Date(task.updated_at).getTime();
      const hasUpdate = Number.isFinite(createdAtMs) && Number.isFinite(updatedAtMs) && updatedAtMs > createdAtMs + 1000;

      if (hasUpdate) {
        next.push({
          id: `task-updated-${task.id}`,
          filter: "tasks",
          eventType: "task_updated",
          title: t("projects.workTimelineTaskUpdatedTitle", { task: task.title }),
          description: t("projects.workTimelineTaskUpdatedDescription"),
          occurredAt: task.updated_at,
          userName: task.assigned_profile_id ? profiles[task.assigned_profile_id] || t("projects.notAssigned") : createdBy,
          phaseName,
          taskName: task.title,
          href: `/projects/${projectId}?tab=tasks`,
          thumbnailUrl: null,
        });
      }

      if (normalizeStatus(task.status) === "completed") {
        next.push({
          id: `task-completed-${task.id}`,
          filter: "tasks",
          eventType: "task_completed",
          title: t("projects.workTimelineTaskCompletedTitle", { task: task.title }),
          description: t("projects.workTimelineTaskCompletedDescription"),
          occurredAt: task.actual_finish || task.updated_at,
          userName: task.assigned_profile_id ? profiles[task.assigned_profile_id] || t("projects.notAssigned") : createdBy,
          phaseName,
          taskName: task.title,
          href: `/projects/${projectId}?tab=tasks`,
          thumbnailUrl: null,
        });
      }
    });

    return next;
  }, [phaseNameById, profiles, projectId, t, tasks]);

  useEffect(() => {
    let isSubscribed = true;

    const run = async () => {
      if (!supabase) {
        if (isSubscribed) {
          setErrorMessage(t("projects.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const [photosResult, financialResult] = await Promise.all([
        loadPhotoEvents(supabase, companyId, projectId, profiles, t),
        loadFinancialEvents(supabase, companyId, projectId, profiles, t),
      ]);

      if (!isSubscribed) {
        return;
      }

      if (photosResult.error || financialResult.error) {
        setErrorMessage(photosResult.error || financialResult.error || t("projects.workTimelineLoadError"));
      }

      setPhotoEvents(photosResult.events);
      setFinancialEvents(financialResult.events);
      setIsLoading(false);
    };

    void run();

    return () => {
      isSubscribed = false;
    };
  }, [companyId, projectId, profiles, supabase, t]);

  const allEvents = useMemo(() => {
    return [...taskEvents, ...photoEvents, ...financialEvents].filter((event) => Boolean(event.occurredAt));
  }, [financialEvents, photoEvents, taskEvents]);

  useEffect(() => {
    if (allEvents.length === 0) {
      return;
    }

    const nextIds = allEvents.map((event) => event.id);
    const nextNew = collectNewEntityIds(knownEventIdsRef.current, nextIds);

    for (const eventId of nextIds) {
      knownEventIdsRef.current.add(eventId);
    }

    const hasNewEvents = hasAnimatedEntries(nextNew);

    const activateTimeout = hasNewEvents
      ? window.setTimeout(() => {
          setNewEventIds(nextNew);
        }, 0)
      : null;

    const timeout = hasNewEvents
      ? window.setTimeout(() => {
          setNewEventIds({});
        }, 420)
      : null;

    return () => {
      if (activateTimeout !== null) {
        window.clearTimeout(activateTimeout);
      }

      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allEvents
      .filter((event) => (filter === "all" ? true : event.filter === filter))
      .filter((event) => {
        if (!normalizedSearch) {
          return true;
        }

        return `${event.title} ${event.description}`.toLowerCase().includes(normalizedSearch);
      })
      .sort((first, second) => {
        const firstMs = new Date(first.occurredAt).getTime();
        const secondMs = new Date(second.occurredAt).getTime();

        if (sort === "newest") {
          return secondMs - firstMs;
        }

        return firstMs - secondMs;
      });
  }, [allEvents, filter, searchTerm, sort]);

  return (
    <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
      <CardHeader className="bg-[var(--color-surface-subtle)]/55">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--color-analytics-100)] text-[var(--color-analytics-700)]">
            <Activity size={15} aria-hidden="true" />
          </span>
          <div>
            <CardTitle className="text-[1.1rem] font-bold text-[var(--color-navy-900)]">{t("projects.workTimelineTitle")}</CardTitle>
            <p className="text-sm text-[var(--color-text-secondary)]">{t("projects.workTimelineDescription")}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5">
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="relative">
              <span className="sr-only">{t("projects.workTimelineSearchLabel")}</span>
              <Search size={14} className="pointer-events-none absolute left-3 top-3.5 text-[var(--color-text-muted)]" aria-hidden="true" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("projects.workTimelineSearchPlaceholder")}
                className="pl-9"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filter} onChange={(event) => setFilter(event.target.value as TimelineFilter)}>
                <option value="all">{t("projects.workTimelineFilterAll")}</option>
                <option value="tasks">{t("projects.workTimelineFilterTasks")}</option>
                <option value="photos">{t("projects.workTimelineFilterPhotos")}</option>
                <option value="financial">{t("projects.workTimelineFilterFinancial")}</option>
                <option value="daily_logs">{t("projects.workTimelineFilterDailyLogs")}</option>
                <option value="inspections">{t("projects.workTimelineFilterInspections")}</option>
              </Select>
              <Select value={sort} onChange={(event) => setSort(event.target.value as TimelineSort)}>
                <option value="newest">{t("projects.workTimelineSortNewest")}</option>
                <option value="oldest">{t("projects.workTimelineSortOldest")}</option>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <TimelineLoadingState />
        ) : errorMessage ? (
          <ErrorState compact title={t("projects.workTimelineLoadErrorTitle")} description={errorMessage} />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            compact
            icon="T"
            title={resolveEmptyTitle(filter, t)}
            description={resolveEmptyDescription(filter, t)}
          />
        ) : (
          <div className="max-h-[560px] space-y-4 overflow-y-auto pr-1">
            {filteredEvents.map((event, index) => (
              <FadeIn key={event.id} durationMs={newEventIds[event.id] ? 190 : 0} className={newEventIds[event.id] ? "" : "bf-no-motion"}>
                <StatusPulse triggerKey={`${event.id}:${event.eventType}`} tone={event.filter === "financial" ? "warning" : "neutral"}>
                  <article className="relative rounded-[12px] border border-[var(--color-border-subtle)] bg-white p-4">
                {index < filteredEvents.length - 1 ? (
                  <span className="absolute bottom-[-16px] left-[14px] top-[42px] w-px bg-[var(--color-border-subtle)]" aria-hidden="true" />
                ) : null}

                <div className="flex items-start gap-3">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]">
                    {eventIcon(event.eventType)}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{event.title}</p>
                      <span className="rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                        {categoryLabel(event.filter, t)}
                      </span>
                    </div>

                    <p className="text-sm text-[var(--color-text-secondary)]">{event.description}</p>

                    <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                      <span>{formatTimestamp(event.occurredAt)}</span>
                      <span>·</span>
                      <span>{formatRelative(event.occurredAt, t)}</span>
                      <span>·</span>
                      <span>{event.userName}</span>
                    </div>

                    {event.phaseName || event.taskName ? (
                      <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                        {event.phaseName ? <span>{t("projects.workTimelineMetaPhase")}: {event.phaseName}</span> : null}
                        {event.taskName ? <span>{t("projects.workTimelineMetaTask")}: {event.taskName}</span> : null}
                      </div>
                    ) : null}

                    {event.thumbnailUrl ? (
                      <div className="mt-2 overflow-hidden rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]">
                        <img
                          src={event.thumbnailUrl}
                          alt={event.title}
                          className="h-28 w-full object-cover"
                          loading="lazy"
                          onError={(current) => {
                            (current.currentTarget as HTMLImageElement).style.display = "none";
                            const parent = current.currentTarget.parentElement;

                            if (parent) {
                              parent.innerHTML = `<div class=\"flex h-28 items-center justify-center text-xs text-[var(--color-text-muted)]\">${t("projects.sitecamImageUnavailable")}</div>`;
                            }
                          }}
                        />
                      </div>
                    ) : null}

                    {event.href ? (
                      <Link href={event.href} className="inline-flex pt-1 text-xs font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
                        {t("projects.workTimelineOpenRecord")}
                      </Link>
                    ) : null}
                  </div>
                </div>
                  </article>
                </StatusPulse>
              </FadeIn>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function loadPhotoEvents(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  projectId: string,
  profiles: Record<string, string>,
  t: (key: string, params?: Record<string, string | number>) => string,
): Promise<{ events: TimelineEvent[]; error: string | null }> {
  if (!supabase) {
    return { events: [], error: t("projects.errorConnect") };
  }

  const photoResponse = await supabase
    .from("project_photos")
    .select("id, created_at, note, uploaded_by, storage_path")
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (photoResponse.error) {
    return { events: [], error: photoResponse.error.message };
  }

  const photoRows = (photoResponse.data || []) as ProjectPhotoRow[];
  const paths = photoRows.map((row) => row.storage_path);

  const signedUrlsResult = paths.length > 0
    ? await supabase.storage.from(STORAGE_BUCKET).createSignedUrls(paths, 60 * 60)
    : { data: [], error: null };

  if (signedUrlsResult.error) {
    return { events: [], error: signedUrlsResult.error.message };
  }

  const signedUrlByPath = (signedUrlsResult.data || []).reduce<Record<string, string>>((acc, item, index) => {
    const path = paths[index];

    if (path && item?.signedUrl) {
      acc[path] = item.signedUrl;
    }

    return acc;
  }, {});

  const events = photoRows.map((photo) => ({
    id: `photo-uploaded-${photo.id}`,
    filter: "photos" as const,
    eventType: "photo_uploaded" as const,
    title: t("projects.workTimelinePhotoUploadedTitle"),
    description: photo.note?.trim() || t("projects.workTimelinePhotoUploadedDescription"),
    occurredAt: photo.created_at,
    userName: photo.uploaded_by ? profiles[photo.uploaded_by] || t("projects.sitecamUnknownUploader") : t("projects.notAssigned"),
    phaseName: null,
    taskName: null,
    href: `/projects/${projectId}?tab=tasks`,
    thumbnailUrl: signedUrlByPath[photo.storage_path] || null,
  }));

  return { events, error: null };
}

async function loadFinancialEvents(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
  projectId: string,
  profiles: Record<string, string>,
  t: (key: string, params?: Record<string, string | number>) => string,
): Promise<{ events: TimelineEvent[]; error: string | null }> {
  if (!supabase) {
    return { events: [], error: t("projects.errorConnect") };
  }

  const [changeOrdersResponse, invoicesResponse, estimatesResponse] = await Promise.all([
    supabase
      .from("change_orders")
      .select("id, title, change_order_number, created_at, created_by")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("invoices")
      .select("id, title, invoice_number, sent_at, created_by")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(25),
    supabase
      .from("estimates")
      .select("id, title, estimate_number, status, updated_at, updated_by")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .eq("status", "approved")
      .order("updated_at", { ascending: false })
      .limit(25),
  ]);

  if (changeOrdersResponse.error || invoicesResponse.error || estimatesResponse.error) {
    return {
      events: [],
      error: changeOrdersResponse.error?.message || invoicesResponse.error?.message || estimatesResponse.error?.message || null,
    };
  }

  const changeOrders = (changeOrdersResponse.data || []) as ChangeOrderRow[];
  const invoices = (invoicesResponse.data || []) as InvoiceRow[];
  const estimates = (estimatesResponse.data || []) as EstimateRow[];

  const changeOrderEvents: TimelineEvent[] = changeOrders.map((item) => ({
    id: `change-order-created-${item.id}`,
    filter: "financial",
    eventType: "change_order_created",
    title: t("projects.workTimelineChangeOrderCreatedTitle", { record: item.change_order_number || item.title }),
    description: item.title || t("projects.workTimelineFinancialFallbackDescription"),
    occurredAt: item.created_at,
    userName: item.created_by ? profiles[item.created_by] || t("projects.notAssigned") : t("projects.notAssigned"),
    phaseName: null,
    taskName: null,
    href: `/change-orders/${item.id}`,
    thumbnailUrl: null,
  }));

  const invoiceEvents: TimelineEvent[] = invoices.map((item) => ({
    id: `invoice-sent-${item.id}`,
    filter: "financial",
    eventType: "invoice_sent",
    title: t("projects.workTimelineInvoiceSentTitle", { record: item.invoice_number || item.title }),
    description: item.title || t("projects.workTimelineFinancialFallbackDescription"),
    occurredAt: item.sent_at || "",
    userName: item.created_by ? profiles[item.created_by] || t("projects.notAssigned") : t("projects.notAssigned"),
    phaseName: null,
    taskName: null,
    href: `/invoices/${item.id}`,
    thumbnailUrl: null,
  }));

  const estimateEvents: TimelineEvent[] = estimates.map((item) => ({
    id: `estimate-approved-${item.id}`,
    filter: "financial",
    eventType: "estimate_approved",
    title: t("projects.workTimelineEstimateApprovedTitle", { record: item.estimate_number || item.title }),
    description: item.title || t("projects.workTimelineFinancialFallbackDescription"),
    occurredAt: item.updated_at,
    userName: item.updated_by ? profiles[item.updated_by] || t("projects.notAssigned") : t("projects.notAssigned"),
    phaseName: null,
    taskName: null,
    href: `/estimates/${item.id}`,
    thumbnailUrl: null,
  }));

  return { events: [...changeOrderEvents, ...invoiceEvents, ...estimateEvents], error: null };
}

function eventIcon(eventType: TimelineEvent["eventType"]) {
  if (eventType === "task_created") {
    return <ClipboardList size={14} aria-hidden="true" />;
  }

  if (eventType === "task_completed") {
    return <CheckCircle2 size={14} aria-hidden="true" />;
  }

  if (eventType === "task_updated") {
    return <FileText size={14} aria-hidden="true" />;
  }

  if (eventType === "photo_uploaded") {
    return <Camera size={14} aria-hidden="true" />;
  }

  return <DollarSign size={14} aria-hidden="true" />;
}

function categoryLabel(filter: Exclude<TimelineFilter, "all">, t: (key: string) => string) {
  if (filter === "tasks") {
    return t("projects.workTimelineFilterTasks");
  }

  if (filter === "photos") {
    return t("projects.workTimelineFilterPhotos");
  }

  if (filter === "financial") {
    return t("projects.workTimelineFilterFinancial");
  }

  if (filter === "daily_logs") {
    return t("projects.workTimelineFilterDailyLogs");
  }

  return t("projects.workTimelineFilterInspections");
}

function resolveEmptyTitle(filter: TimelineFilter, t: (key: string) => string) {
  if (filter === "daily_logs") {
    return t("projects.workTimelineEmptyDailyLogsTitle");
  }

  if (filter === "inspections") {
    return t("projects.workTimelineEmptyInspectionsTitle");
  }

  return t("projects.workTimelineEmptyTitle");
}

function resolveEmptyDescription(filter: TimelineFilter, t: (key: string) => string) {
  if (filter === "daily_logs") {
    return t("projects.workTimelineEmptyDailyLogsDescription");
  }

  if (filter === "inspections") {
    return t("projects.workTimelineEmptyInspectionsDescription");
  }

  return t("projects.workTimelineEmptyDescription");
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelative(value: string, t: (key: string, params?: Record<string, string | number>) => string) {
  const deltaMs = Date.now() - new Date(value).getTime();

  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return t("projects.workTimelineRelativeNow");
  }

  const minutes = Math.floor(deltaMs / (1000 * 60));

  if (minutes < 60) {
    return t("projects.workTimelineRelativeMinutes", { count: Math.max(1, minutes) });
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return t("projects.workTimelineRelativeHours", { count: hours });
  }

  const days = Math.floor(hours / 24);
  return t("projects.workTimelineRelativeDays", { count: days });
}

function TimelineLoadingState() {
  return (
    <div className="space-y-3">
      <SkeletonLoader className="h-20 w-full" />
      <SkeletonLoader className="h-20 w-full" />
      <SkeletonLoader className="h-20 w-full" />
      <SkeletonLoader className="h-20 w-full" />
    </div>
  );
}

function normalizeStatus(value: string) {
  return value.trim().toLowerCase();
}
