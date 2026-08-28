"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { ProjectCommitmentsControl } from "./project-commitments-control";
import { ProjectCrewCompensationWorkspace } from "./project-crew-compensation-workspace";

export function ProjectBudgetControlDetails({ projectId }: { projectId: string }) {
  const client = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [budget, setBudget] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!client) {
        if (active) setErrorMessage("Budget details are unavailable because the workspace connection is not configured.");
        return;
      }
      const workspace = await resolveWorkspaceContext(client);
      if (!active) return;
      if (!workspace.context) {
        setErrorMessage(workspace.errorMessage || "Unable to resolve the project workspace.");
        return;
      }
      setCompanyId(workspace.context.companyId);
      const db = client as unknown as {
        // Project-control data is migration-backed while generated types catch up.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: (table: string) => any;
      };
      const result = await db
        .from("projects")
        .select("contract_amount,estimated_cost")
        .eq("company_id", workspace.context.companyId)
        .eq("id", projectId)
        .maybeSingle();
      if (!active) return;
      if (result.error) {
        setErrorMessage("B.O.S. could not load the live project budget.");
        return;
      }
      setBudget(result.data ? Number(result.data.contract_amount ?? result.data.estimated_cost ?? 0) : null);
    }
    void load();
    return () => {
      active = false;
    };
  }, [client, projectId]);

  if (errorMessage) {
    return <p role="status" className="rounded-[12px] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-4 py-3 text-sm font-semibold text-[var(--color-warning-800)]">{errorMessage}</p>;
  }
  if (!companyId) {
    return <p className="rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-4 py-3 text-sm font-semibold text-[var(--bos-text-medium-on-light)]">Loading live budget and commitments…</p>;
  }

  return <ProjectCommitmentsControl projectId={projectId} companyId={companyId} budget={budget} />;
}

export function ProjectCrewControlDetails({ projectId }: { projectId: string }) {
  const [localeTag, setLocaleTag] = useState("en-US");
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language) setLocaleTag(navigator.language);
  }, []);
  return <ProjectCrewCompensationWorkspace projectId={projectId} localeTag={localeTag} />;
}
