"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createCrewService, type CrewService } from "./service";
import type {
  Crew,
  CrewDashboardSummary,
  CrewQuickFilter,
  CrewSortKey,
  CrewStatus,
} from "./types";

type UseCrewsParams = {
  service?: CrewService;
};

const DEFAULT_PAGE_SIZE = 8;
const QUICK_FILTER_FETCH_SIZE = 1000;

export function useCrews({ service }: UseCrewsParams = {}) {
  const crewService = useMemo(() => service ?? createCrewService(), [service]);
  const [items, setItems] = useState<Crew[]>([]);
  const [summary, setSummary] = useState<CrewDashboardSummary>({ totalCrews: 0, activeCrews: 0, availableCrews: 0, assignedCrews: 0 });
  const [leadOptions, setLeadOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [supervisorOptions, setSupervisorOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [query, setQueryState] = useState("");
  const [status, setStatusState] = useState<CrewStatus | "all">("all");
  const [leadId, setLeadIdState] = useState("all");
  const [supervisorId, setSupervisorIdState] = useState("all");
  const [projectId, setProjectIdState] = useState("all");
  const [assignmentStatus, setAssignmentStatusState] = useState<"all" | "none" | "planned" | "confirmed" | "in_progress" | "completed" | "cancelled">("all");
  const [quickFilter, setQuickFilterState] = useState<CrewQuickFilter>("all");
  const [sortBy, setSortByState] = useState<CrewSortKey>("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [partialNotices, setPartialNotices] = useState<string[]>([]);

  const resetPage = useCallback(() => setPage(1), []);
  const setQuery = useCallback((value: string) => { setQueryState(value); resetPage(); }, [resetPage]);
  const setStatus = useCallback((value: CrewStatus | "all") => { setStatusState(value); setQuickFilterState("all"); resetPage(); }, [resetPage]);
  const setLeadId = useCallback((value: string) => { setLeadIdState(value); resetPage(); }, [resetPage]);
  const setSupervisorId = useCallback((value: string) => { setSupervisorIdState(value); resetPage(); }, [resetPage]);
  const setProjectId = useCallback((value: string) => { setProjectIdState(value); setQuickFilterState("all"); resetPage(); }, [resetPage]);
  const setAssignmentStatus = useCallback((value: "all" | "none" | "planned" | "confirmed" | "in_progress" | "completed" | "cancelled") => { setAssignmentStatusState(value); setQuickFilterState("all"); resetPage(); }, [resetPage]);
  const setQuickFilter = useCallback((value: CrewQuickFilter) => { setQuickFilterState(value); resetPage(); }, [resetPage]);
  const setSortBy = useCallback((value: CrewSortKey) => { setSortByState(value); resetPage(); }, [resetPage]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const usesQuickFilter = quickFilter !== "all";
      const listResult = await crewService.getCrews({
        query,
        status,
        leadId,
        supervisorId,
        projectId,
        assignmentStatus,
        sortBy,
        page: usesQuickFilter ? 1 : page,
        pageSize: usesQuickFilter ? QUICK_FILTER_FETCH_SIZE : pageSize,
      });

      let nextItems = listResult.items;
      if (quickFilter === "active") nextItems = nextItems.filter((crew) => crew.isActive);
      if (quickFilter === "available") nextItems = nextItems.filter((crew) => crew.availability === "available");
      if (quickFilter === "assigned") nextItems = nextItems.filter((crew) => crew.availability === "assigned");

      if (usesQuickFilter) {
        const filteredTotal = nextItems.length;
        const filteredPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
        const safePage = Math.max(1, Math.min(page, filteredPages));
        const start = (safePage - 1) * pageSize;
        setItems(nextItems.slice(start, start + pageSize));
        setTotal(filteredTotal);
        setTotalPages(filteredPages);
        if (safePage !== page) setPage(safePage);
      } else {
        setItems(nextItems);
        setTotal(listResult.total);
        setTotalPages(listResult.totalPages);
        setPage(listResult.page);
        setPageSize(listResult.pageSize);
      }

      setSummary(listResult.summary);
      setLeadOptions(listResult.options.leadOptions);
      setSupervisorOptions(listResult.options.supervisorOptions);
      setProjectOptions(listResult.options.projectOptions);
      setPartialNotices(listResult.partialNotices);
    } catch {
      setErrorMessage("crews.errorLoad");
    } finally {
      setIsLoading(false);
    }
  }, [assignmentStatus, page, pageSize, projectId, query, quickFilter, crewService, leadId, sortBy, status, supervisorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const activeFilters = useMemo(() => {
    let count = 0;
    if (query.trim()) count += 1;
    if (status !== "all") count += 1;
    if (leadId !== "all") count += 1;
    if (supervisorId !== "all") count += 1;
    if (projectId !== "all") count += 1;
    if (assignmentStatus !== "all") count += 1;
    if (quickFilter !== "all") count += 1;
    return count;
  }, [assignmentStatus, leadId, projectId, query, quickFilter, status, supervisorId]);

  return {
    items, summary, leadOptions, supervisorOptions, projectOptions,
    query, setQuery, status, setStatus, leadId, setLeadId, supervisorId, setSupervisorId,
    projectId, setProjectId, assignmentStatus, setAssignmentStatus, quickFilter, setQuickFilter,
    sortBy, setSortBy, page, pageSize, setPageSize, total, totalPages, canPrev, canNext,
    setPage, activeFilters, isLoading, errorMessage, partialNotices, refresh,
  };
}
