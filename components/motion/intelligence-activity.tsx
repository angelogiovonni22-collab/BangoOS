"use client";

import { useMotionPreferences } from "./motion-provider";

type IntelligenceActivityProps = {
  active: boolean;
  label: string;
  className?: string;
};

export function IntelligenceActivity({ active, label, className }: IntelligenceActivityProps) {
  const { reducedMotion } = useMotionPreferences();

  if (!active) {
    return null;
  }

  if (reducedMotion) {
    return (
      <div className={["bf-intel-static", className].filter(Boolean).join(" ")} aria-live="polite">
        <span className="bf-intel-dot" aria-hidden="true" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className={["bf-intel-activity", className].filter(Boolean).join(" ")} aria-live="polite">
      <span className="bf-intel-dot" aria-hidden="true" />
      <span>{label}</span>
      <span className="bf-intel-track" aria-hidden="true">
        <span className="bf-intel-bar" />
      </span>
    </div>
  );
}
