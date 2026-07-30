"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createCrewService, type CrewService } from "./service";
import type {
  Crew,
  CrewAvailabilityStatus,
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
    averageCrewSize: 0,
    utilization: 0,
    certificationCompliance: 0,
    schedulingConflicts: 0,
  });
  const [specialtyOptions, setSpecialtyOptions] = useState<string[]>([]);
  const [query, setQueryState] = useState("");
  const [status, setStatusState] = useState<CrewStatus | "all">("all");
  const [availability, setAvailabilityState] = useState<CrewAvailabilityStatus | "all">("all");
  const [specialty, setSpecialtyState] = useState("all");
  const [sortBy, setSortByState] = useState<CrewSortKey>("name_asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setPage(1);
  }, []);

  const setStatus = useCallback((value: CrewStatus | "all") => {
    setStatusState(value);
    setPage(1);
  }, []);

  const setAvailability = useCallback((value: CrewAvailabilityStatus | "all") => {
    setAvailabilityState(value);
    setPage(1);
  }, []);

  const setSpecialty = useCallback((value: string) => {
    setSpecialtyState(value);
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
      const [listResult, summaryResult, specialtyResult] = await Promise.all([
        crewService.getCrews({
          query,
          status,
          availability,
          specialty,
          sortBy,
          page,
          pageSize,
        }),
        crewService.getSummary(),
        crewService.getSpecialtyOptions(),
      ]);

      setItems(listResult.items);
      setTotal(listResult.total);
      setTotalPages(listResult.totalPages);
      setPage(listResult.page);
      setPageSize(listResult.pageSize);
      setSummary(summaryResult);
      setSpecialtyOptions(specialtyResult);
    } catch {
      setErrorMessage("crews.errorLoad");
    } finally {
      setIsLoading(false);
    }
  }, [availability, page, pageSize, query, crewService, sortBy, specialty, status]);

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

    if (availability !== "all") {
      count += 1;
    }

    if (specialty !== "all") {
      count += 1;
    }

    return count;
  }, [availability, query, specialty, status]);

  return {
    items,
    summary,
    specialtyOptions,
    query,
    setQuery,
    status,
    setStatus,
    availability,
    setAvailability,
    specialty,
    setSpecialty,
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
    refresh,
  };
}
