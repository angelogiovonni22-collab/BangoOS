"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEmptyChecklist,
  createEmptyMobileDailyReportDraft,
  type CrewCheckInAction,
  type DailyChecklist,
  type ForemanDashboardData,
  type MobileDailyReportDraft,
  type MobileFieldOperationsService,
} from "./mobile-field-operations-types";
import { createMobileFieldOperationsService } from "./mobile-field-operations-service";
import { createBrowserFieldOfflineProviders } from "./field-offline-queue";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type UseMobileFieldOperationsParams = {
  service?: MobileFieldOperationsService;
};

export function useMobileFieldOperations(params: UseMobileFieldOperationsParams = {}) {
  const service = useMemo(() => {
    if (params.service) return params.service;
    const client = createClient();
    const offline = createBrowserFieldOfflineProviders(async () => {
      const result = await resolveWorkspaceContext(client);
      if (!result.context) throw new Error(result.errorMessage);
      return { companyId: result.context.companyId, userId: result.context.userId };
    });
    return createMobileFieldOperationsService({ offlineQueue: offline.queue, offlineSync: offline.sync });
  }, [params.service]);

  const [data, setData] = useState<ForemanDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await service.getForemanDashboard();
      setData(payload);
    } catch {
      setErrorMessage("Unable to load mobile field operations workspace.");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    const synchronize = () => {
      void service.syncOfflineActions().then((result) => {
        if (result.synced > 0) setActionMessage(`${result.synced} offline field action${result.synced === 1 ? "" : "s"} synchronized.`);
        if (result.failed > 0) setErrorMessage(`${result.failed} offline field action${result.failed === 1 ? "" : "s"} need review.`);
        if (result.synced > 0 || result.failed > 0) void refresh();
      });
    };
    window.addEventListener("online", synchronize);
    if (navigator.onLine) synchronize();
    return () => window.removeEventListener("online", synchronize);
  }, [refresh, service]);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
    setIsMutating(true);
    setActionMessage(null);
    setErrorMessage(null);

    try {
      await action();
      setActionMessage(successMessage);
      await refresh();
    } catch {
      setErrorMessage("Unable to complete mobile field operation.");
    } finally {
      setIsMutating(false);
    }
  }, [refresh]);

  return {
    data,
    isLoading,
    isMutating,
    errorMessage,
    actionMessage,
    refresh,
    createEmptyChecklist,
    createEmptyMobileDailyReportDraft,
    runCheckInAction: async (input: { crewId: string; action: CrewCheckInAction }) =>
      runAction(() => service.runCheckInAction(input), "Crew check-in updated."),
    saveChecklist: async (input: { crewId: string; checklist: DailyChecklist }) =>
      runAction(() => service.saveDailyChecklist(input), "Daily checklist saved."),
    submitMobileDailyReport: async (input: {
      crewId: string;
      reportDate: string;
      status: "draft" | "submitted" | "reviewed" | "approved";
      draft: MobileDailyReportDraft;
    }) => {
      setIsMutating(true);
      setActionMessage(null);
      setErrorMessage(null);

      try {
        const result = await service.submitMobileDailyReport(input);
        setActionMessage("Mobile daily report submitted.");
        await refresh();
        return result;
      } catch {
        setErrorMessage("Unable to submit mobile daily report.");
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    checkoutEquipment: async (input: { crewId: string; equipmentIds: string[]; conditionNotes: string }) =>
      runAction(() => service.checkoutEquipment(input).then(() => undefined), "Equipment checked out."),
    returnEquipment: async (input: { checkoutId: string; conditionNotes: string }) =>
      runAction(() => service.returnEquipment(input).then(() => undefined), "Equipment returned."),
    retryOfflineAction: async (id: string) =>
      runAction(() => service.retryOfflineAction(id).then(() => undefined), "Offline action retried."),
    discardOfflineAction: async (id: string) =>
      runAction(() => service.discardOfflineAction(id), "Offline action discarded."),
  };
}
