"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createDailyReportsService, type DailyReportsService } from "./service";
import type { DailyReportStatus, DailyReportUpsertInput } from "./types";
import { validateDailyReportInput } from "./validation";
import { dailyReportDate } from "./date";
import { createReportCreationDraftStore } from "./report-creation-draft";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type UseDailyReportParams = {
  reportId?: string;
  initialDate?: string;
  initialProjectId?: string;
  initialProjectName?: string;
  service?: DailyReportsService;
};

export function useDailyReport({ reportId, initialDate, initialProjectId, initialProjectName, service }: UseDailyReportParams = {}) {
  const serviceRef = useRef<DailyReportsService>(service ?? createDailyReportsService());
  const activeRequestRef = useRef(0);
  const savingRef = useRef(false);
  const creationIdRef = useRef<string | null>(null);
  const reportVersionRef = useRef<{ status: DailyReportStatus; updatedAt: string } | undefined>(undefined);
  const [creationStore] = useState(() => createReportCreationDraftStore(async () => {
    const workspace = await resolveWorkspaceContext(createClient());
    if (!workspace.context) throw new Error(workspace.errorMessage);
    return {companyId:workspace.context.companyId,userId:workspace.context.userId};
  }));
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
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [pendingCreationId, setPendingCreationId] = useState<string | null>(null);
  const [recoveredReportId, setRecoveredReportId] = useState<string | null>(null);

  const load = useCallback(async (ignoreRecovery = false) => {
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

        reportVersionRef.current = {status:report.header.overallStatus,updatedAt:report.updatedAt};
        setDraft(serviceRef.current.toUpsertInput(report));
        setStatus(report.header.overallStatus);
        setResolvedReportId(report.id);
      } else {
        const pending = ignoreRecovery ? null : await creationStore.load().catch(() => {
          setSaveErrorMessage("Device recovery storage is unavailable. Keep this page open; a new report cannot be sent until its recovery reference can be saved.");
          return null;
        });
        if (unmountedRef.current || requestId !== activeRequestRef.current) return;
        if (pending) {
          creationIdRef.current = pending.creationId;
          setPendingCreationId(pending.creationId);
          setDraft(pending.draft);
          setStatus(pending.draft.header.overallStatus);
          return;
        }
        const date = initialDate || dailyReportDate();
        const seeded = await serviceRef.current.createDraftFromSchedule(date);

        if (unmountedRef.current || requestId !== activeRequestRef.current) {
          return;
        }

        const scheduleMatchesProject = !initialProjectId || seeded.header.projectId === initialProjectId;
        setDraft(initialProjectId ? {
          ...seeded,
          header: {
            ...seeded.header,
            projectId: initialProjectId,
            projectName: initialProjectName || seeded.header.projectName,
          },
          schedulingPreload: scheduleMatchesProject ? seeded.schedulingPreload : null,
          labor: scheduleMatchesProject ? seeded.labor : [],
        } : seeded);
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
  }, [creationStore, initialDate, initialProjectId, initialProjectName, reportId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  const save = useCallback(async (nextStatus: DailyReportStatus) => {
    if (!draft || savingRef.current || recoveredReportId) {
      return null;
    }

    const validation = validateDailyReportInput(draft);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return null;
    }

    const saveRequest = activeRequestRef.current;
    savingRef.current = true;
    setValidationErrors([]);
    setSaveErrorMessage(null);
    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (resolvedReportId) {
        const updated = await serviceRef.current.updateReport(resolvedReportId, draft, nextStatus, reportVersionRef.current);

        if (unmountedRef.current || saveRequest !== activeRequestRef.current) return null;
        if (!updated) {
          setSaveErrorMessage("This report is unavailable. Your current fields have been kept.");
          return null;
        }

        reportVersionRef.current = {status:updated.header.overallStatus,updatedAt:updated.updatedAt};
        setDraft(serviceRef.current.toUpsertInput(updated));
        setStatus(updated.header.overallStatus);
        return updated.id;
      }

      const creationId = creationIdRef.current ?? crypto.randomUUID();
      creationIdRef.current = creationId;
      setPendingCreationId(creationId);
      await creationStore.save({creationId,draft});
      const created = await serviceRef.current.createReport(draft, nextStatus, creationId);
      if (unmountedRef.current || saveRequest !== activeRequestRef.current) return null;
      if (created.recoveredCreation) {
        setRecoveredReportId(created.id);
        await creationStore.save({creationId,draft}).catch(() => {
          setSaveErrorMessage("The saved report was recovered, but this device could not retain your unsent fields. Keep this page open and copy any needed text before leaving.");
        });
        return null;
      }
      await creationStore.remove(creationId).catch(() => undefined);
      setPendingCreationId(null);
      creationIdRef.current = null;
      reportVersionRef.current = {status:created.header.overallStatus,updatedAt:created.updatedAt};
      setResolvedReportId(created.id);
      setDraft(serviceRef.current.toUpsertInput(created));
      setStatus(created.header.overallStatus);
      return created.id;
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : "Unable to save this report. Your fields have been kept.");
      return null;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [creationStore, draft, recoveredReportId, resolvedReportId]);

  const startSeparateReport = useCallback(async () => {
    if (savingRef.current || !creationIdRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await creationStore.remove(creationIdRef.current);
      creationIdRef.current = null;
      setPendingCreationId(null);
      setRecoveredReportId(null);
      setResolvedReportId(null);
      setSaveErrorMessage(null);
      await load(true);
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : "Unable to clear this device draft.");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [creationStore, load]);

  const regenerateSummary = useCallback(async () => {
    if (!resolvedReportId) {
      return;
    }

    const refreshed = await serviceRef.current.regenerateSummary(resolvedReportId);

    if (refreshed) {
      reportVersionRef.current = {status:refreshed.header.overallStatus,updatedAt:refreshed.updatedAt};
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
    saveErrorMessage,
    pendingCreationId,
    recoveredReportId,
    startSeparateReport,
    save,
    regenerateSummary,
    reload: load,
  };
}
