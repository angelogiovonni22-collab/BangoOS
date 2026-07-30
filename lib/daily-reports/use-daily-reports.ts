"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export function useDailyReports({ service = createDailyReportsService() }: UseDailyReportsParams = {}) {
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [dashboard, list] = await Promise.all([
        service.getDashboard(),
        service.listReports(filters),
      ]);

      setMetrics(dashboard.metrics);
      setAnalytics(dashboard.analytics);
      setProjectOptions(dashboard.projectOptions);
      setSuperintendentOptions(dashboard.superintendentOptions);
      setItems(list.items);
      setTotal(list.total);
      setTotalPages(list.totalPages);
      setFilters((current) => ({
        ...current,
        page: list.page,
        pageSize: list.pageSize,
      }));
    } catch {
      setErrorMessage("dailyReports.error.loadDashboard");
    } finally {
      setIsLoading(false);
    }
  }, [filters, service]);

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
    errorMessage,
    refresh,
    setFilter: updateFilter,
    setStatus,
    setSortBy,
    setQuery,
  };
}
