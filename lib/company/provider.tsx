"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { WorkspaceContext } from "@/lib/supabase/workspace";

type CompanyContextValue = {
  userId: string;
  companyId: string;
  companyName: string | null;
  companySlug: string | null;
  role: string | null;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

type CompanyProviderProps = {
  children: ReactNode;
  workspace: WorkspaceContext;
};

export function CompanyProvider({ children, workspace }: CompanyProviderProps) {
  const value = useMemo<CompanyContextValue>(
    () => ({
      userId: workspace.userId,
      companyId: workspace.companyId,
      companyName: workspace.companyName,
      companySlug: workspace.companySlug,
      role: workspace.role,
    }),
    [workspace.companyId, workspace.companyName, workspace.companySlug, workspace.role, workspace.userId],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);

  if (!context) {
    throw new Error("useCompany must be used within a CompanyProvider.");
  }

  return context;
}
