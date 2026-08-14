"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createWorkforceOperationsService,
  type WorkforceOperationsService,
} from "./workforce-operations-service";
import type {
  OrionRecommendationOutcomeStatus,
  WorkforceOperationsDashboardData,
} from "./workforce-operations-types";

type UseWorkforceOperationsDashboardParams = {
  service?: WorkforceOperationsService;
};

export function useWorkforceOperationsDashboard(
  params: UseWorkforceOperationsDashboardParams = {},
) {
  const service = useMemo(
    () => params.service || createWorkforceOperationsService(),
    [params.service],
  );

  const [data, setData] = useState<WorkforceOperationsDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload = await service.getDashboard();
      setData(payload);
    } catch {
      setErrorMessage("Unable to load workforce operations dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const runAction = useCallback(async (action: () => Promise<void>, successMessage: string) => {
    setIsMutating(true);
    setActionMessage(null);
    setErrorMessage(null);

    try {
      await action();
      setActionMessage(successMessage);
      await refresh();
    } catch {
      setErrorMessage("Unable to complete supervisor action.");
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
    assignEmployeeToCrew: async (input: Parameters<WorkforceOperationsService["assignEmployeeToCrew"]>[0]) =>
      runAction(() => service.assignEmployeeToCrew(input), "Employee assigned to crew."),
    reassignEmployeeToCrew: async (input: Parameters<WorkforceOperationsService["reassignEmployeeToCrew"]>[0]) =>
      runAction(() => service.reassignEmployeeToCrew(input), "Employee reassigned to crew."),
    removeEmployeeFromCrew: async (input: Parameters<WorkforceOperationsService["removeEmployeeFromCrew"]>[0]) =>
      runAction(() => service.removeEmployeeFromCrew(input), "Employee removed from crew."),
    moveEmployeeBetweenProjects: async (input: Parameters<WorkforceOperationsService["moveEmployeeBetweenProjects"]>[0]) =>
      runAction(() => service.moveEmployeeBetweenProjects(input), "Employee moved between projects."),
    assignSupervisorToCrew: async (input: Parameters<WorkforceOperationsService["assignSupervisorToCrew"]>[0]) =>
      runAction(() => service.assignSupervisorToCrew(input), "Supervisor assigned to crew."),
    assignEquipmentToCrew: async (input: Parameters<WorkforceOperationsService["assignEquipmentToCrew"]>[0]) =>
      runAction(() => service.assignEquipmentToCrew(input), "Equipment assignment submitted."),
    setCrewShiftStatus: async (input: Parameters<WorkforceOperationsService["setCrewShiftStatus"]>[0]) =>
      runAction(() => service.setCrewShiftStatus(input), "Crew shift status updated."),
    acknowledgeRecommendation: async (input: Parameters<WorkforceOperationsService["acknowledgeRecommendation"]>[0]) =>
      runAction(() => service.acknowledgeRecommendation(input), "Recommendation acknowledged."),
    acceptRecommendation: async (input: Parameters<WorkforceOperationsService["acceptRecommendation"]>[0]) =>
      runAction(() => service.acceptRecommendation(input), "Recommendation accepted."),
    dismissRecommendation: async (input: Parameters<WorkforceOperationsService["dismissRecommendation"]>[0]) =>
      runAction(() => service.dismissRecommendation(input), "Recommendation dismissed."),
    completeRecommendation: async (input: Parameters<WorkforceOperationsService["completeRecommendation"]>[0]) =>
      runAction(() => service.completeRecommendation(input), "Recommendation marked complete."),
    recordRecommendationOutcome: async (input: { recommendationId: string; outcomeStatus: OrionRecommendationOutcomeStatus; note?: string }) =>
      runAction(() => service.recordRecommendationOutcome(input), "Recommendation outcome recorded."),
  };
}
