"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createEmployeeService, type EmployeeService } from "./service";
import type {
  AvailabilityStatus,
  Employee,
  EmployeeDashboardSummary,
  EmploymentStatus,
  SortKey,
} from "./types";

type UseEmployeesParams = {
  service?: EmployeeService;
};

const DEFAULT_PAGE_SIZE = 10;

export function useEmployees({ service = createEmployeeService() }: UseEmployeesParams = {}) {
  const [items, setItems] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<EmployeeDashboardSummary>({
    totalEmployees: 0,
    activeToday: 0,
    available: 0,
    assignedToProjects: 0,
    onLeave: 0,
  });
  const [crewOptions, setCrewOptions] = useState<string[]>([]);
  const [query, setQueryState] = useState("");
  const [crew, setCrewState] = useState("all");
  const [employmentStatus, setEmploymentStatusState] = useState<EmploymentStatus | "all">("all");
  const [availabilityStatus, setAvailabilityStatusState] = useState<AvailabilityStatus | "all">("all");
  const [sortBy, setSortByState] = useState<SortKey>("name_asc");
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

  const setCrew = useCallback((value: string) => {
    setCrewState(value);
    setPage(1);
  }, []);

  const setEmploymentStatus = useCallback((value: EmploymentStatus | "all") => {
    setEmploymentStatusState(value);
    setPage(1);
  }, []);

  const setAvailabilityStatus = useCallback((value: AvailabilityStatus | "all") => {
    setAvailabilityStatusState(value);
    setPage(1);
  }, []);

  const setSortBy = useCallback((value: SortKey) => {
    setSortByState(value);
    setPage(1);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [listResult, summaryResult, crewResult] = await Promise.all([
        service.getEmployees({
          query,
          crew,
          employmentStatus,
          availabilityStatus,
          sortBy,
          page,
          pageSize,
        }),
        service.getSummary(),
        service.getCrewOptions(),
      ]);

      setItems(listResult.items);
      setTotal(listResult.total);
      setTotalPages(listResult.totalPages);
      setPage(listResult.page);
      setPageSize(listResult.pageSize);
      setSummary(summaryResult);
      setCrewOptions(crewResult);
    } catch {
      setErrorMessage("employees.errorLoad");
    } finally {
      setIsLoading(false);
    }
  }, [availabilityStatus, crew, employmentStatus, page, pageSize, query, service, sortBy]);

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

    if (crew !== "all") {
      count += 1;
    }

    if (employmentStatus !== "all") {
      count += 1;
    }

    if (availabilityStatus !== "all") {
      count += 1;
    }

    return count;
  }, [availabilityStatus, crew, employmentStatus, query]);

  return {
    items,
    summary,
    crewOptions,
    query,
    setQuery,
    crew,
    setCrew,
    employmentStatus,
    setEmploymentStatus,
    availabilityStatus,
    setAvailabilityStatus,
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
