"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import type { AdaptiveBosModuleKey, AdaptiveBosResolvedConfig } from "./config";

type AdaptiveBosContextValue = AdaptiveBosResolvedConfig & {
  hasModule: (moduleKey:AdaptiveBosModuleKey) => boolean;
  term: (key:string, fallback?:string) => string;
};

const AdaptiveBosContext = createContext<AdaptiveBosContextValue | null>(null);

export function AdaptiveBosProvider({ children, config }:{ children:ReactNode; config:AdaptiveBosResolvedConfig }) {
  const value = useMemo<AdaptiveBosContextValue>(() => {
    const modules = new Set(config.enabledModules);
    return {
      ...config,
      hasModule:(moduleKey) => modules.has(moduleKey),
      term:(key,fallback) => config.labels[key] || fallback || key,
    };
  }, [config]);

  useEffect(() => {
    document.documentElement.dataset.bosIndustry = config.industryKey;
    document.documentElement.dataset.bosIndustryLabel = config.industryLabel;
    return () => {
      delete document.documentElement.dataset.bosIndustry;
      delete document.documentElement.dataset.bosIndustryLabel;
    };
  }, [config.industryKey, config.industryLabel]);

  return <AdaptiveBosContext.Provider value={value}>{children}</AdaptiveBosContext.Provider>;
}

export function useAdaptiveBos() {
  const context = useContext(AdaptiveBosContext);
  if (!context) throw new Error("useAdaptiveBos must be used within AdaptiveBosProvider");
  return context;
}
