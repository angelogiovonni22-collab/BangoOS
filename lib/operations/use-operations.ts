"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createOperationsService, type OperationsService } from "./service";
import type {
  AttentionScope,
  OperationsFilters,
  OperationsPayload,
  OperationsShift,
} from "./types";

type UseOperationsParams = {
  service?: OperationsService;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function useOperations({ service = createOperationsService() }: UseOperationsParams = {}) {
  const [filters, setFilters] = useState<OperationsFilters>({
    date: todayIsoDate(),
    shift: "day",
    project: "all",
    query: "",
  });
  const [attentionScope, setAttentionScope] = useState<AttentionScope>("all");
  const [payload, setPayload] = useState<OperationsPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const setDate = useCallback((date: string) => {
    setFilters((current) => ({ ...current, date }));
  }, []);

  const setShift = useCallback((shift: OperationsShift | "all") => {
    setFilters((current) => ({ ...current, shift }));
  }, []);

  const setProject = useCallback((project: string) => {
    setFilters((current) => ({ ...current, project }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setFilters((current) => ({ ...current, query }));
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await service.getOperations(filters);
      setPayload(result);
    } catch {
      setErrorMessage("operations.errorLoad");
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

  const filteredAttention = useMemo(() => {
    if (!payload) {
      return [];
    }

    if (attentionScope === "all") {
      return payload.attentionQueue;
    }

    if (attentionScope === "critical") {
      return payload.attentionQueue.filter((item) => item.priority === "critical");
    }

    if (attentionScope === "today") {
      return payload.attentionQueue.filter((item) => item.scope === "today" || item.dueAt.startsWith(filters.date));
    }

    return payload.attentionQueue.filter((item) => item.scope === attentionScope);
  }, [attentionScope, filters.date, payload]);

  return {
    filters,
    setDate,
    setShift,
    setProject,
    setQuery,
    attentionScope,
    setAttentionScope,
    payload,
    filteredAttention,
    isLoading,
    errorMessage,
    refresh,
  };
}
