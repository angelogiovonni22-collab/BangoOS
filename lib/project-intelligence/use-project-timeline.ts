"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createManualNoteEvent } from "./mock-data";
import { createProjectIntelligenceService, type ProjectIntelligenceService } from "./service";
import type {
  NewManualProjectNoteInput,
  ProjectEvent,
  ProjectEventActor,
  ProjectEventCategory,
  ProjectEventImpactArea,
  ProjectEventPriority,
  ProjectTimelineDateGroup,
  ProjectTimelineDateRange,
  ProjectTimelineFilters,
  ProjectTimelineRiskItem,
  ProjectTimelineSummary,
} from "./types";

const DEFAULT_FILTERS: ProjectTimelineFilters = {
  category: "all",
  priority: "all",
  impact: "all",
  dateRange: "all_time",
};

type UseProjectTimelineParams = {
  projectId: string;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  currentActor: ProjectEventActor;
  service?: ProjectIntelligenceService;
};

const localStorageKey = (projectId: string) => `bangoos.project-intelligence.notes.${projectId}`;

export function useProjectTimeline({
  projectId,
  locale,
  t,
  currentActor,
  service = createProjectIntelligenceService(),
}: UseProjectTimelineParams) {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [manualNotes, setManualNotes] = useState<ProjectEvent[]>(() => readManualNotes(projectId));
  const [filters, setFilters] = useState<ProjectTimelineFilters>(DEFAULT_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  const [summary, setSummary] = useState<ProjectTimelineSummary | null>(null);
  const [riskSummary, setRiskSummary] = useState<ProjectTimelineRiskItem[]>([]);

  const loadTimeline = useCallback(async () => {
    if (!projectId) {
      setErrorMessage(t("projects.intelligenceErrorProjectId"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [projectEvents, timelineSummary, timelineRisks] = await Promise.all([
        service.getProjectEvents(projectId),
        service.getProjectTimelineSummary(projectId),
        service.getProjectRiskEvents(projectId),
      ]);

      setEvents(sortEvents(projectEvents));
      setSummary(timelineSummary);
      setRiskSummary(timelineRisks);
    } catch {
      setErrorMessage(t("projects.intelligenceErrorLoad"));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, service, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTimeline();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadTimeline]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim().toLowerCase());
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    window.localStorage.setItem(localStorageKey(projectId), JSON.stringify(manualNotes));
  }, [manualNotes, projectId]);

  const mergedEvents = useMemo(() => sortEvents([...events, ...manualNotes]), [events, manualNotes]);

  const filteredEvents = useMemo(() => {
    return mergedEvents.filter((event) => {
      if (filters.category !== "all" && event.category !== filters.category) {
        return false;
      }

      if (filters.priority !== "all" && event.priority !== filters.priority) {
        return false;
      }

      if (filters.impact !== "all" && !event.impactAreas.includes(filters.impact)) {
        return false;
      }

      if (!matchesDateRange(event.occurredAt, filters.dateRange)) {
        return false;
      }

      if (!debouncedSearchTerm) {
        return true;
      }

      return searchProjectEvent(event, debouncedSearchTerm);
    });
  }, [debouncedSearchTerm, filters, mergedEvents]);

  const groupedEvents = useMemo<ProjectTimelineDateGroup[]>(() => {
    const groups = new Map<string, ProjectEvent[]>();

    filteredEvents.forEach((event) => {
      const key = event.occurredAt.slice(0, 10);
      const current = groups.get(key) || [];
      current.push(event);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([key, dayEvents]) => ({
        key,
        label: formatGroupDateLabel(key, locale, t),
        events: sortEvents(dayEvents),
      }));
  }, [filteredEvents, locale, t]);

  const countsByCategory = useMemo(() => {
    return mergedEvents.reduce<Record<ProjectEventCategory, number>>((acc, event) => {
      const previous = acc[event.category] || 0;
      return {
        ...acc,
        [event.category]: previous + 1,
      };
    }, {} as Record<ProjectEventCategory, number>);
  }, [mergedEvents]);

  const highlightedRiskEvents = useMemo(() => {
    return filteredEvents.filter((event) => event.priority === "critical" || event.aiContext?.requiresAttention).slice(0, 6);
  }, [filteredEvents]);

  const derivedSummary = useMemo(() => {
    if (summary) {
      return {
        ...summary,
        totalEvents: mergedEvents.length,
      };
    }

    return {
      totalEvents: mergedEvents.length,
      openRisks: highlightedRiskEvents.length,
      financialImpactTotal: mergedEvents.reduce((total, event) => {
        if (!event.financialImpact) {
          return total;
        }

        return total + (event.financialImpact.direction === "increase" ? event.financialImpact.amount : -event.financialImpact.amount);
      }, 0),
      scheduleDelayDays: mergedEvents.reduce((total, event) => total + (event.scheduleImpact?.delayDays || 0), 0),
      scheduleRecoveredDays: mergedEvents.reduce((total, event) => total + (event.scheduleImpact?.recoveredDays || 0), 0),
      lastDailyReportAt: mergedEvents.find((event) => event.eventType === "daily_report_created")?.occurredAt || null,
      lastSiteCamUploadAt: mergedEvents.find((event) => event.eventType === "site_photo_uploaded")?.occurredAt || null,
      latestCustomerActivityAt: mergedEvents.find((event) => event.category === "customer")?.occurredAt || null,
      latestInspectionResult: "none" as const,
      latestActivityAt: mergedEvents[0]?.occurredAt || null,
      firstActivityAt: mergedEvents[mergedEvents.length - 1]?.occurredAt || null,
    };
  }, [highlightedRiskEvents.length, mergedEvents, summary]);

  const activeFilterCount = useMemo(() => {
    let count = 0;

    if (filters.category !== "all") {
      count += 1;
    }

    if (filters.priority !== "all") {
      count += 1;
    }

    if (filters.impact !== "all") {
      count += 1;
    }

    if (filters.dateRange !== "all_time") {
      count += 1;
    }

    if (debouncedSearchTerm) {
      count += 1;
    }

    return count;
  }, [debouncedSearchTerm, filters]);

  const addManualNote = useCallback((input: NewManualProjectNoteInput) => {
    const createdEvent = createManualNoteEvent(projectId, input, currentActor);
    setManualNotes((current) => sortEvents([createdEvent, ...current]));
  }, [currentActor, projectId]);

  const setCategoryFilter = useCallback((category: ProjectEventCategory | "all") => {
    setFilters((current) => ({ ...current, category }));
  }, []);

  const setPriorityFilter = useCallback((priority: ProjectEventPriority | "all") => {
    setFilters((current) => ({ ...current, priority }));
  }, []);

  const setImpactFilter = useCallback((impact: ProjectEventImpactArea | "all") => {
    setFilters((current) => ({ ...current, impact }));
  }, []);

  const setDateRangeFilter = useCallback((dateRange: ProjectTimelineDateRange) => {
    setFilters((current) => ({ ...current, dateRange }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchTerm("");
    setDebouncedSearchTerm("");
  }, []);

  return {
    isLoading,
    errorMessage,
    events: mergedEvents,
    filteredEvents,
    groupedEvents,
    summary: derivedSummary,
    riskSummary,
    highlightedRiskEvents,
    countsByCategory,
    filters,
    searchTerm,
    matchedCount: filteredEvents.length,
    activeFilterCount,
    setSearchTerm,
    setCategoryFilter,
    setPriorityFilter,
    setImpactFilter,
    setDateRangeFilter,
    clearFilters,
    addManualNote,
    refresh: loadTimeline,
    isEmpty: !isLoading && !errorMessage && mergedEvents.length === 0,
  };
}

function sortEvents(events: ProjectEvent[]) {
  return [...events].sort((a, b) => (a.occurredAt > b.occurredAt ? -1 : 1));
}

function matchesDateRange(occurredAt: string, dateRange: ProjectTimelineDateRange) {
  if (dateRange === "all_time" || dateRange === "custom") {
    return true;
  }

  const now = new Date();
  const date = new Date(occurredAt);

  if (dateRange === "today") {
    return date.toDateString() === now.toDateString();
  }

  const boundary = new Date(now);
  boundary.setHours(0, 0, 0, 0);

  if (dateRange === "last_7_days") {
    boundary.setDate(boundary.getDate() - 6);
    return date >= boundary;
  }

  boundary.setDate(boundary.getDate() - 29);
  return date >= boundary;
}

function searchProjectEvent(event: ProjectEvent, query: string) {
  const metadataKeywords = Array.isArray(event.metadata.keywords)
    ? (event.metadata.keywords as string[])
    : [];

  const searchBody = [
    event.title,
    event.description,
    event.actor.name,
    event.category,
    event.relatedEntity?.label || "",
    metadataKeywords.join(" "),
    event.aiContext?.summary || "",
    event.aiContext?.riskSignals.join(" ") || "",
  ]
    .join(" ")
    .toLowerCase();

  return searchBody.includes(query);
}

function formatGroupDateLabel(
  key: string,
  locale: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  const date = new Date(`${key}T00:00:00`);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return t("projects.intelligenceDateToday");
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return t("projects.intelligenceDateYesterday");
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function readManualNotes(projectId: string) {
  if (!projectId || typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(localStorageKey(projectId));

    if (!raw) {
      return [];
    }

    return sortEvents(JSON.parse(raw) as ProjectEvent[]);
  } catch {
    return [];
  }
}
