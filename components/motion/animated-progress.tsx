"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { useMotionPreferences } from "./motion-provider";

type AnimatedProgressProps = {
  value: number;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  durationMs?: number;
};

export function AnimatedProgress({
  value,
  className,
  trackClassName,
  fillClassName,
  durationMs = 210,
}: AnimatedProgressProps) {
  const { reducedMotion } = useMotionPreferences();
  const normalized = Math.max(0, Math.min(100, Math.round(value)));

  const fillStyle = useMemo<CSSProperties>(() => ({
    width: "100%",
    transform: `scaleX(${normalized / 100})`,
    transitionDuration: reducedMotion ? "0ms" : `${durationMs}ms`,
  }), [durationMs, normalized, reducedMotion]);

  return (
    <div className={["bf-progress-track", trackClassName, className].filter(Boolean).join(" ")}>
      <div className={["bf-progress-fill", fillClassName].filter(Boolean).join(" ")} style={fillStyle} />
    </div>
  );
}
