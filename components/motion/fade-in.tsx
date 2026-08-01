"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { useMotionPreferences } from "./motion-provider";

type FadeInProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  durationMs?: number;
  distancePx?: number;
};

export function FadeIn({
  children,
  className,
  delayMs = 0,
  durationMs,
  distancePx = 6,
}: FadeInProps) {
  const { reducedMotion, ready } = useMotionPreferences();

  const style = useMemo<CSSProperties>(() => ({
    ["--bf-delay" as string]: `${Math.max(0, delayMs)}ms`,
    ["--bf-distance" as string]: `${Math.max(0, distancePx)}px`,
    ...(durationMs ? { ["--bf-duration" as string]: `${Math.max(0, durationMs)}ms` } : {}),
  }), [delayMs, distancePx, durationMs]);

  const classes = [
    reducedMotion || !ready ? "bf-no-motion" : "bf-fade-in",
    className || "",
  ].filter(Boolean).join(" ");

  return <div className={classes} style={style}>{children}</div>;
}
