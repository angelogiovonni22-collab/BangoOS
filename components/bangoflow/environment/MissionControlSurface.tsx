"use client";

import type { ReactNode } from "react";

type MissionControlSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function MissionControlSurface({ children, className }: MissionControlSurfaceProps) {
  return <div className={["bf-material-surface bf-material-mission", className || ""].filter(Boolean).join(" ")}>{children}</div>;
}
