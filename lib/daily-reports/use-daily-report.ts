"use client";

import { useCallback, useEffect, useState } from "react";
import { createDailyReportsService, type DailyReportsService } from "./service";
import type { DailyReportStatus, DailyReportUpsertInput } from "./types";
import { validateDailyReportInput } from "./validation";

type UseDailyReportParams = {
  reportId?: string;
  initialDate?: string;
  service?: DailyReportsService;
};

export function useDailyReport({ reportId, initialDate, service = createDailyReportsService() }: UseDailyReportParams = {}) {
  const [draft, setDraft] = useState<DailyReportUpsertInput | null>(null);
  const [resolvedReportId, setResolvedReportId] = useState<string | null>(reportId || null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<DailyReportStatus>("draft");

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (reportId) {
        const report = await service.getReport(reportId);

        if (!report) {
          setErrorMessage("dailyReports.error.notFound");
          setDraft(null);
          return;
        }

        setDraft(service.toUpsertInput(report));
        setStatus(report.header.overallStatus);
        setResolvedReportId(report.id);
      } else {
        const date = initialDate || new Date().toISOString().slice(0, 10);
        const seeded = await service.createDraftFromSchedule(date);
        setDraft(seeded);
        setStatus("draft");
      }
    } catch {
      setErrorMessage("dailyReports.error.loadReport");
    } finally {
      setIsLoading(false);
    }
  }, [initialDate, reportId, service]);

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
        const updated = await service.updateReport(resolvedReportId, draft, nextStatus);

        if (!updated) {
          setErrorMessage("dailyReports.error.notFound");
          return null;
        }

        setDraft(service.toUpsertInput(updated));
        setStatus(updated.header.overallStatus);
        return updated.id;
      }

      const created = await service.createReport(draft, nextStatus);
      setResolvedReportId(created.id);
      setDraft(service.toUpsertInput(created));
      setStatus(created.header.overallStatus);
      return created.id;
    } catch {
      setErrorMessage("dailyReports.error.save");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [draft, resolvedReportId, service]);

  const regenerateSummary = useCallback(async () => {
    if (!resolvedReportId) {
      return;
    }

    const refreshed = await service.regenerateSummary(resolvedReportId);

    if (refreshed) {
      setDraft(service.toUpsertInput(refreshed));
      setStatus(refreshed.header.overallStatus);
    }
  }, [resolvedReportId, service]);

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
