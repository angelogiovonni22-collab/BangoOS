"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { getExecutiveDashboardMockData } from "./mock-data";
import type { ExecutiveDashboardData } from "./types";

export function useExecutiveDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      if (!supabase) {
        if (isSubscribed) {
          setIsLoading(false);
          setErrorMessage("Unable to connect right now. Please try again shortly.");
        }

        return;
      }

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage);
          setIsLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("companies")
        .select("name")
        .eq("id", workspace.context.companyId)
        .maybeSingle<{ name: string | null }>();

      if (!isSubscribed) {
        return;
      }

      if (error) {
        setErrorMessage(error.message);
      }

      setCompanyName(data?.name?.trim() || null);
      setIsLoading(false);
    };

    void run();

    return () => {
      isSubscribed = false;
    };
  }, [supabase]);

  const data: ExecutiveDashboardData = useMemo(() => getExecutiveDashboardMockData(), []);

  return {
    companyName,
    isLoading,
    errorMessage,
    data,
  };
}
