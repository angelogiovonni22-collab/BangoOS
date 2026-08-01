"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createCrewService, type CrewService } from "./service";
import type {
  Crew,
  CrewDashboardSummary,
  CrewSortKey,
  CrewStatus,
} from "./types";

type UseCrewsParams = {
  service?: CrewService;
};

const DEFAULT_PAGE_SIZE = 8;

export function useCrews({ service }: UseCrewsParams = {}) {
  const crewService = useMemo(() => service ?? createCrewService(), [service]);
  const [items, setItems] = useState<Crew[]>([]);
  const [summary, setSummary] = useState<CrewDashboardSummary>({
    totalCrews: 0,
    activeCrews: 0,
    availableCrews: 0,
    assignedCrews: 0,
  });
  const [leadOptions, setLeadOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [supervisorOptions, setSupervisorOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [query, setQueryState] = useState("");
  const [status, setStatusState] = useState<CrewStatus | "all">("all");
  const [leadId, setLeadIdState] = useState("all");
  const [supervisorId, setSupervisorIdState] = useState("all");
  const [projectId, setProjectIdState] = useState("all");
  const [assignmentStatus, setAssignmentStatusState] = useState<"all" | "none" | "planned" | "confirmed" | "in_progress" | "completed" | "cancelled">("all");
  const [sortBy, setSortByState] = useState<CrewSortKey>("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [partialNotices, setPartialNotices] = useState<string[]>([]);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setPage(1);
  }, []);

  const setStatus = useCallback((value: CrewStatus | "all") => {
    setStatusState(value);
    setPage(1);
  }, []);

  const setLeadId = useCallback((value: string) => {
    setLeadIdState(value);
    setPage(1);
  }, []);

  const setSupervisorId = useCallback((value: string) => {
    setSupervisorIdState(value);
    setPage(1);
  }, []);

  const setProjectId = useCallback((value: string) => {
    setProjectIdState(value);
    setPage(1);
  }, []);

  const setAssignmentStatus = useCallback((value: "all" | "none" | "planned" | "confirmed" | "in_progress" | "completed" | "cancelled") => {
    setAssignmentStatusState(value);
    setPage(1);
  }, []);

  const setSortBy = useCallback((value: CrewSortKey) => {
    setSortByState(value);
    setPage(1);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const listResult = await crewService.getCrews({
        query,
        status,
        leadId,
        supervisorId,
        projectId,
        assignmentStatus,
        sortBy,
        page,
        pageSize,
      });

      setItems(listResult.items);
      setTotal(listResult.total);
      setTotalPages(listResult.totalPages);
      setPage(listResult.page);
      setPageSize(listResult.pageSize);
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
  }, [assignmentStatus, page, pageSize, projectId, query, crewService, leadId, sortBy, status, supervisorId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const activeFilters = useMemo(() => {
    let count = 0;

    if (query.trim()) {
      count += 1;
    }

    if (status !== "all") {
      count += 1;
    }

    if (leadId !== "all") {
      count += 1;
    }

    if (supervisorId !== "all") {
      count += 1;
    }

    if (projectId !== "all") {
      count += 1;
    }

    if (assignmentStatus !== "all") {
      count += 1;
    }

    return count;
  }, [assignmentStatus, leadId, projectId, query, status, supervisorId]);

  return {
    items,
    summary,
    leadOptions,
    supervisorOptions,
    projectOptions,
    query,
    setQuery,
    status,
    setStatus,
    leadId,
    setLeadId,
    supervisorId,
    setSupervisorId,
    projectId,
    setProjectId,
    assignmentStatus,
    setAssignmentStatus,
    sortBy,
    setSortBy,
    page,
    pageSize,
    setPageSize,
    total,
    totalPages,
    canPrev,
    canNext,
    setPage,
    activeFilters,
    isLoading,
    errorMessage,
    partialNotices,
    refresh,
  };
}
