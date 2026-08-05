"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export function useEmployees({ service }: UseEmployeesParams = {}) {
  const employeeService = useMemo(() => service ?? createEmployeeService(), [service]);
  const latestRequestId = useRef(0);
  const [items, setItems] = useState<Employee[]>([]);
  const [summary, setSummary] = useState<EmployeeDashboardSummary>({
    totalEmployees: 0,
    activeToday: 0,
    available: 0,
    assignedToProjects: 0,
    onLeave: 0,
  });
  const [crewOptions, setCrewOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [supervisorOptions, setSupervisorOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [query, setQueryState] = useState("");
  const [crewId, setCrewState] = useState("all");
  const [supervisorId, setSupervisorIdState] = useState("all");
  const [projectId, setProjectIdState] = useState("all");
  const [employmentStatus, setEmploymentStatusState] = useState<EmploymentStatus | "all">("all");
  const [availabilityStatus, setAvailabilityStatusState] = useState<AvailabilityStatus | "all">("all");
  const [sortBy, setSortByState] = useState<SortKey>("name_asc");
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

  const setCrewId = useCallback((value: string) => {
    setCrewState(value);
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
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const listResult = await employeeService.getEmployees({
        query,
        crewId,
        supervisorId,
        projectId,
        employmentStatus,
        availabilityStatus,
        sortBy,
        page,
        pageSize,
      });

      if (requestId !== latestRequestId.current) {
        return;
      }

      setItems(listResult.items);
      setTotal(listResult.total);
      setTotalPages(listResult.totalPages);
      setPage(listResult.page);
      setPageSize(listResult.pageSize);
      setSummary(listResult.summary);
      setCrewOptions(listResult.options.crewOptions);
      setSupervisorOptions(listResult.options.supervisorOptions);
      setProjectOptions(listResult.options.projectOptions);
      setPartialNotices(listResult.partialNotices);
    } catch {
      if (requestId !== latestRequestId.current) {
        return;
      }

      setErrorMessage("employees.errorLoad");
    } finally {
      if (requestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [availabilityStatus, crewId, employmentStatus, page, pageSize, projectId, query, employeeService, sortBy, supervisorId]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) {
        return;
      }

      void refresh();
    });

    return () => {
      active = false;
    };
  }, [refresh]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  const activeFilters = useMemo(() => {
    let count = 0;

    if (query.trim()) {
      count += 1;
    }

    if (crewId !== "all") {
      count += 1;
    }

    if (supervisorId !== "all") {
      count += 1;
    }

    if (projectId !== "all") {
      count += 1;
    }

    if (employmentStatus !== "all") {
      count += 1;
    }

    if (availabilityStatus !== "all") {
      count += 1;
    }

    return count;
  }, [availabilityStatus, crewId, employmentStatus, projectId, query, supervisorId]);

  return {
    items,
    summary,
    crewOptions,
    supervisorOptions,
    projectOptions,
    query,
    setQuery,
    crewId,
    setCrewId,
    supervisorId,
    setSupervisorId,
    projectId,
    setProjectId,
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
    partialNotices,
    refresh,
  };
}
