"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDailyReportsService, type DailyReportsService } from "./service";
import type {
  DailyReport,
  DailyReportAnalytics,
  DailyReportDashboardMetrics,
  DailyReportFilters,
  DailyReportSortKey,
  DailyReportStatus,
} from "./types";

const DEFAULT_PAGE_SIZE = 6;

const initialFilters: DailyReportFilters = {
  date: "",
  projectId: "all",
  superintendentId: "all",
  status: "all",
  query: "",
  sortBy: "date_desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

type UseDailyReportsParams = {
  service?: DailyReportsService;
};

export function mergePaginationFilters(
  current: DailyReportFilters,
  page: number,
  pageSize: number,
): DailyReportFilters {
  if (current.page === page && current.pageSize === pageSize) {
    return current;
  }

  return {
    ...current,
    page,
    pageSize,
  };
}

export function useDailyReports({ service }: UseDailyReportsParams = {}) {
  const serviceRef = useRef<DailyReportsService>(service ?? createDailyReportsService());
  const activeRequestRef = useRef(0);
  const unmountedRef = useRef(false);
  const hasSettledOnceRef = useRef(false);

  useEffect(() => {
    if (service) {
      serviceRef.current = service;
    }
  }, [service]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const [items, setItems] = useState<DailyReport[]>([]);
  const [metrics, setMetrics] = useState<DailyReportDashboardMetrics>({
    reportsCreatedToday: 0,
    reportsPendingReview: 0,
    reportsSubmitted: 0,
    lateReports: 0,
    safetyIncidents: 0,
    delaysLogged: 0,
    laborHours: 0,
    weatherSnapshot: "mixed",
  });
  const [analytics, setAnalytics] = useState<DailyReportAnalytics>({
    laborHours: 0,
    productionUnits: 0,
    delayEvents: 0,
    incidentCount: 0,
    completionRate: 0,
    averageSubmissionHours: 0,
  });
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [superintendentOptions, setSuperintendentOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [filters, setFilters] = useState<DailyReportFilters>(initialFilters);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasSettledOnce, setHasSettledOnce] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    const shouldShowInitialLoading = !hasSettledOnceRef.current;

    if (shouldShowInitialLoading) {
      setIsLoading(true);
      setErrorMessage(null);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [dashboard, list] = await Promise.all([
        serviceRef.current.getDashboard(),
        serviceRef.current.listReports(filters),
      ]);

      if (unmountedRef.current || requestId !== activeRequestRef.current) {
        return;
      }

      setMetrics(dashboard.metrics);
      setAnalytics(dashboard.analytics);
      setProjectOptions(dashboard.projectOptions);
      setSuperintendentOptions(dashboard.superintendentOptions);
      setItems(list.items);
      setTotal(list.total);
      setTotalPages(list.totalPages);
      setFilters((current) => mergePaginationFilters(current, list.page, list.pageSize));
      hasSettledOnceRef.current = true;
      setHasSettledOnce(true);
    } catch {
      if (unmountedRef.current || requestId !== activeRequestRef.current) {
        return;
      }

      if (!hasSettledOnceRef.current) {
        setErrorMessage("dailyReports.error.loadDashboard");
      }
    } finally {
      if (unmountedRef.current || requestId !== activeRequestRef.current) {
        return;
      }

      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const updateFilter = useCallback(<K extends keyof DailyReportFilters>(key: K, value: DailyReportFilters[K]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" || key === "pageSize" ? current.page : 1,
    }));
  }, []);

  const setStatus = useCallback((status: DailyReportStatus | "all") => {
    updateFilter("status", status);
  }, [updateFilter]);

  const setSortBy = useCallback((sortBy: DailyReportSortKey) => {
    updateFilter("sortBy", sortBy);
  }, [updateFilter]);

  const setQuery = useCallback((query: string) => {
    updateFilter("query", query);
  }, [updateFilter]);

  const canPrev = filters.page > 1;
  const canNext = filters.page < totalPages;

  const activeFilters = useMemo(() => {
    let count = 0;

    if (filters.date) {
      count += 1;
    }

    if (filters.projectId !== "all") {
      count += 1;
    }

    if (filters.superintendentId !== "all") {
      count += 1;
    }

    if (filters.status !== "all") {
      count += 1;
    }

    if (filters.query.trim()) {
      count += 1;
    }

    return count;
  }, [filters]);

  return {
    items,
    metrics,
    analytics,
    projectOptions,
    superintendentOptions,
    filters,
    total,
    totalPages,
    canPrev,
    canNext,
    activeFilters,
    isLoading,
    isRefreshing,
    hasSettledOnce,
    errorMessage,
    refresh,
    setFilter: updateFilter,
    setStatus,
    setSortBy,
    setQuery,
  };
}
