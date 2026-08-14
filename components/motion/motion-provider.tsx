"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BANGO_MOTION_TOKENS } from "./motion-tokens";
import {
  readStoredMotionPreference,
  resolveReducedMotion,
  type MotionPreference,
  writeStoredMotionPreference,
} from "./motion-preferences";

type MotionContextValue = {
  preference: MotionPreference;
  setPreference: (next: MotionPreference) => void;
  reducedMotion: boolean;
  ready: boolean;
};

const MotionContext = createContext<MotionContextValue | null>(null);

type MotionProviderProps = {
  children: ReactNode;
  defaultPreference?: MotionPreference;
};

export function MotionProvider({ children, defaultPreference = "system" }: MotionProviderProps) {
  const [preference, setPreferenceState] = useState<MotionPreference>(defaultPreference);
  const [systemPrefersReduced, setSystemPrefersReduced] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const storedPreference = readStoredMotionPreference();

    const hydrationTimeout = window.setTimeout(() => {
      setPreferenceState(storedPreference);
      setSystemPrefersReduced(mediaQuery.matches);
      setReady(true);
    }, 0);

    const onChange = (event: MediaQueryListEvent) => setSystemPrefersReduced(event.matches);
    mediaQuery.addEventListener("change", onChange);

    return () => {
      window.clearTimeout(hydrationTimeout);
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  const reducedMotion = !ready || resolveReducedMotion(preference, systemPrefersReduced);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motionPreference = preference;
    root.dataset.motionReduced = reducedMotion ? "true" : "false";

    root.style.setProperty("--bf-duration-instant", `${BANGO_MOTION_TOKENS.durationMs.instant}ms`);
    root.style.setProperty("--bf-duration-fast", `${BANGO_MOTION_TOKENS.durationMs.fast}ms`);
    root.style.setProperty("--bf-duration-standard", `${BANGO_MOTION_TOKENS.durationMs.standard}ms`);
    root.style.setProperty("--bf-duration-deliberate", `${BANGO_MOTION_TOKENS.durationMs.deliberate}ms`);
    root.style.setProperty("--bf-duration-emphasis", `${BANGO_MOTION_TOKENS.durationMs.emphasis}ms`);

    root.style.setProperty("--bf-ease-standard", BANGO_MOTION_TOKENS.easing.standard);
    root.style.setProperty("--bf-ease-enter", BANGO_MOTION_TOKENS.easing.enter);
    root.style.setProperty("--bf-ease-exit", BANGO_MOTION_TOKENS.easing.exit);
    root.style.setProperty("--bf-ease-spring-soft", BANGO_MOTION_TOKENS.easing.springSoft);
    root.style.setProperty("--bf-ease-spring-firm", BANGO_MOTION_TOKENS.easing.springFirm);
  }, [preference, reducedMotion, ready]);

  const value = useMemo<MotionContextValue>(() => ({
    preference,
    setPreference: (next) => {
      setPreferenceState(next);
      writeStoredMotionPreference(next);
    },
    reducedMotion,
    ready,
  }), [preference, reducedMotion, ready]);

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotionPreferences(): MotionContextValue {
  const context = useContext(MotionContext);
  if (!context) {
    throw new Error("useMotionPreferences must be used within MotionProvider.");
  }

  return context;
}
