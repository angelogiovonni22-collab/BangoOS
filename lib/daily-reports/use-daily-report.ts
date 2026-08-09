"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createDailyReportsService, type DailyReportsService } from "./service";
import type { DailyReportStatus, DailyReportUpsertInput } from "./types";
import { validateDailyReportInput } from "./validation";

type UseDailyReportParams = {
  reportId?: string;
  initialDate?: string;
  service?: DailyReportsService;
};

export function useDailyReport({ reportId, initialDate, service }: UseDailyReportParams = {}) {
  const serviceRef = useRef<DailyReportsService>(service ?? createDailyReportsService());
  const activeRequestRef = useRef(0);
  const unmountedRef = useRef(false);

  useEffect(() => {
    if (service) {
      serviceRef.current = service;
    }
  }, [service]);

  useEffect(() => {
    // React Strict Mode intentionally mounts, cleans up, and mounts effects
    // again in development. Reset the guard on every effect mount so the
    // second mount can accept the draft initialization request.
    unmountedRef.current = false;

    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const [draft, setDraft] = useState<DailyReportUpsertInput | null>(null);
  const [resolvedReportId, setResolvedReportId] = useState<string | null>(reportId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<DailyReportStatus>("draft");

  const load = useCallback(async () => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (reportId) {
        const report = await serviceRef.current.getReport(reportId);

        if (unmountedRef.current || requestId !== activeRequestRef.current) {
          return;
        }

        if (!report) {
          setErrorMessage("dailyReports.error.notFound");
          setDraft(null);
          return;
        }

        setDraft(serviceRef.current.toUpsertInput(report));
        setStatus(report.header.overallStatus);
        setResolvedReportId(report.id);
      } else {
        const date = initialDate || new Date().toISOString().slice(0, 10);
        const seeded = await serviceRef.current.createDraftFromSchedule(date);

        if (unmountedRef.current || requestId !== activeRequestRef.current) {
          return;
        }

        setDraft(seeded);
        setStatus("draft");
      }
    } catch {
      if (unmountedRef.current || requestId !== activeRequestRef.current) {
        return;
      }

      setErrorMessage("dailyReports.error.loadReport");
    } finally {
      if (unmountedRef.current || requestId !== activeRequestRef.current) {
        return;
      }

      setIsLoading(false);
    }
  }, [initialDate, reportId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  const save = useCallback(async (nextStatus: DailyReportStatus) => {
    if (!draft) {
      return null;
    }

    const validation = validateDailyReportInput(draft);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return null;
    }

    setValidationErrors([]);
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (resolvedReportId) {
        const updated = await serviceRef.current.updateReport(resolvedReportId, draft, nextStatus);

        if (!updated) {
          setErrorMessage("dailyReports.error.notFound");
          return null;
        }

        setDraft(serviceRef.current.toUpsertInput(updated));
        setStatus(updated.header.overallStatus);
        return updated.id;
      }

      const created = await serviceRef.current.createReport(draft, nextStatus);
      setResolvedReportId(created.id);
      setDraft(serviceRef.current.toUpsertInput(created));
      setStatus(created.header.overallStatus);
      return created.id;
    } catch {
      setErrorMessage("dailyReports.error.save");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [draft, resolvedReportId]);

  const regenerateSummary = useCallback(async () => {
    if (!resolvedReportId) {
      return;
    }

    const refreshed = await serviceRef.current.regenerateSummary(resolvedReportId);

    if (refreshed) {
      setDraft(serviceRef.current.toUpsertInput(refreshed));
      setStatus(refreshed.header.overallStatus);
    }
  }, [resolvedReportId]);

  return {
    draft,
    setDraft,
    status,
    resolvedReportId,
    isLoading,
    isSaving,
    errorMessage,
    validationErrors,
    save,
    regenerateSummary,
    reload: load,
  };
}
