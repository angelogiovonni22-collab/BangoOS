"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { CommandCenterFocusFilter, OperationsCommandCenterData } from "./command-center-types";
import { getOperationsCommandCenter } from "./command-center-service";

type UseOperationsCommandCenterParams = {
  localeTag: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function useOperationsCommandCenter({ localeTag, t }: UseOperationsCommandCenterParams) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<OperationsCommandCenterData | null>(null);
  const hasDataRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [focusFilter, setFocusFilter] = useState<CommandCenterFocusFilter>("all");

  useEffect(() => {
    hasDataRef.current = data !== null;
  }, [data]);

  const refresh = useCallback(async (options?: { preserveData?: boolean }) => {
    const preserveData = options?.preserveData ?? hasDataRef.current;

    if (preserveData) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setErrorMessage(null);
    setIsPermissionError(false);

    if (!supabase) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      setIsLoading(false);
      return;
    }

    const workspace = await resolveWorkspaceContext(supabase);

    if (!workspace.context) {
      setErrorMessage(workspace.errorMessage);
      setIsPermissionError(workspace.errorCode === "unauthenticated" || workspace.errorCode === "company_missing");
      setIsLoading(false);
      return;
    }

    try {
      const result = await getOperationsCommandCenter(supabase, workspace.context, localeTag, t);
      setData(result.data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load operations command center.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [localeTag, supabase, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh({ preserveData: false });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [refresh]);

  const filteredPriorityQueue = useMemo(() => {
    if (!data) {
      return [];
    }

    if (focusFilter === "all") {
      return data.priorityQueue;
    }

    if (focusFilter === "critical") {
      return data.priorityQueue.filter((item) => item.severity === "critical");
    }

    return data.priorityQueue.filter((item) => item.focus === focusFilter);
  }, [data, focusFilter]);

  const filteredPendingDecisions = useMemo(() => {
    if (!data) {
      return [];
    }

    if (focusFilter === "approvals" || focusFilter === "all") {
      return data.pendingDecisions;
    }

    return focusFilter === "critical"
      ? data.pendingDecisions.filter((item) => item.severity === "critical" || item.severity === "high")
      : data.pendingDecisions;
  }, [data, focusFilter]);

  return {
    data,
    isLoading,
    isRefreshing,
    errorMessage,
    isPermissionError,
    focusFilter,
    setFocusFilter,
    filteredPriorityQueue,
    filteredPendingDecisions,
    refresh,
  };
}