"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSchedulingService, type SchedulingService } from "./service";
import type {
  AssignmentDraft,
  DispatchStatus,
  ScheduleAssignment,
  ScheduleFilterState,
  ScheduleGroup,
  ScheduleView,
  SchedulingPayload,
} from "./types";

type UseSchedulingParams = {
  service?: SchedulingService;
};

const initialFilters: ScheduleFilterState = {
  query: "",
  project: "all",
  crew: "all",
  employeeTrade: "all",
  shift: "all",
  status: "all",
  groupBy: "project",
};

export function useScheduling({ service = createSchedulingService() }: UseSchedulingParams = {}) {
  const [payload, setPayload] = useState<SchedulingPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [view, setView] = useState<ScheduleView>("week");
  const [filters, setFilters] = useState<ScheduleFilterState>(initialFilters);
  const [periodDate, setPeriodDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const next = await service.getScheduling();
      setPayload(next);
    } catch {
      setErrorMessage("scheduling.errorLoad");
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

  const setGroupBy = useCallback((groupBy: ScheduleGroup) => {
    setFilters((current) => ({ ...current, groupBy }));
  }, []);

  const setFilter = useCallback(<K extends keyof ScheduleFilterState>(key: K, value: ScheduleFilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const createNewAssignment = useCallback(async (draft: AssignmentDraft) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const next = await service.createAssignment(draft);
      setPayload(next);
      setLastActionMessage("scheduling.feedback.assignmentCreated");
    } catch {
      setErrorMessage("scheduling.errorSaveAssignment");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const moveDispatch = useCallback(async (dispatchId: string, status: DispatchStatus, delayReason: string | null = null) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const next = await service.moveDispatchResource(dispatchId, status, delayReason);
      setPayload(next);
      setLastActionMessage("scheduling.feedback.dispatchUpdated");
    } catch {
      setErrorMessage("scheduling.errorDispatchUpdate");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const fillOpenShift = useCallback(async (openShiftId: string, employeeId: string | null, crewId: string | null) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const next = await service.assignOpenShift(openShiftId, employeeId, crewId);
      setPayload(next);
      setLastActionMessage("scheduling.feedback.openShiftFilled");
    } catch {
      setErrorMessage("scheduling.errorOpenShift");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const resolveConflict = useCallback(async (conflictId: string, status: "acknowledged" | "dismissed" | "resolved") => {
    setIsLoading(true);

    try {
      const next = await service.resolveConflict(conflictId, status);
      setPayload(next);
      setLastActionMessage("scheduling.feedback.conflictUpdated");
    } catch {
      setErrorMessage("scheduling.errorConflictUpdate");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const acceptInsight = useCallback(async (insightId: string) => {
    setIsLoading(true);

    try {
      const next = await service.acceptInsight(insightId);
      setPayload(next);
      setLastActionMessage("scheduling.feedback.insightAccepted");
    } catch {
      setErrorMessage("scheduling.errorInsightUpdate");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const dismissInsight = useCallback(async (insightId: string) => {
    setIsLoading(true);

    try {
      const next = await service.dismissInsight(insightId);
      setPayload(next);
      setLastActionMessage("scheduling.feedback.insightDismissed");
    } catch {
      setErrorMessage("scheduling.errorInsightUpdate");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const moveAssignmentCard = useCallback(async (
    assignmentId: string,
    changes: Partial<Pick<ScheduleAssignment, "date" | "shift" | "assignedCrewIds" | "assignedEmployeeIds" | "startTime" | "endTime">>,
  ) => {
    setIsLoading(true);

    try {
      const next = await service.moveAssignment(assignmentId, changes);
      setPayload(next);
      setLastActionMessage("scheduling.feedback.assignmentMoved");
    } catch {
      setErrorMessage("scheduling.errorAssignmentMove");
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  const filteredAssignments = useMemo(() => {
    if (!payload) {
      return [];
    }

    const query = filters.query.trim().toLowerCase();

    return payload.assignments.filter((item) => {
      const matchesQuery = !query
        || item.title.toLowerCase().includes(query)
        || item.scope.projectName.toLowerCase().includes(query)
        || item.scope.location.toLowerCase().includes(query)
        || item.requiredTrade.toLowerCase().includes(query);

      const matchesProject = filters.project === "all" || item.scope.projectId === filters.project;
      const matchesCrew = filters.crew === "all" || item.assignedCrewIds.includes(filters.crew);
      const matchesShift = filters.shift === "all" || item.shift === filters.shift;
      const matchesStatus = filters.status === "all" || item.status === filters.status;
      const matchesTrade = filters.employeeTrade === "all" || item.requiredTrade === filters.employeeTrade;

      return matchesQuery && matchesProject && matchesCrew && matchesShift && matchesStatus && matchesTrade;
    });
  }, [filters, payload]);

  return {
    payload,
    filteredAssignments,
    filters,
    setFilter,
    setGroupBy,
    view,
    setView,
    periodDate,
    setPeriodDate,
    isLoading,
    errorMessage,
    lastActionMessage,
    refresh,
    createNewAssignment,
    moveDispatch,
    fillOpenShift,
    resolveConflict,
    acceptInsight,
    dismissInsight,
    moveAssignmentCard,
  };
}
