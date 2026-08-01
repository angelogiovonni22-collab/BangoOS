"use client";

import type { ReactNode } from "react";
import { useMotionPreferences } from "./motion-provider";

type StatusPulseProps = {
  triggerKey: string;
  tone?: "warning" | "critical" | "success" | "neutral";
  className?: string;
  children: ReactNode;
};

export function StatusPulse({ triggerKey, tone = "neutral", className, children }: StatusPulseProps) {
  const { reducedMotion } = useMotionPreferences();

  const toneClass =
    tone === "critical"
      ? "bf-pulse-critical"
      : tone === "warning"
        ? "bf-pulse-warning"
        : tone === "success"
          ? "bf-pulse-success"
          : "bf-pulse-neutral";

  return (
    <div className={className}>
      <div key={reducedMotion ? "reduced" : `pulse-${triggerKey}`} className={reducedMotion ? "" : `bf-pulse-once ${toneClass}`}>
        {children}
      </div>
    </div>
  );
}
