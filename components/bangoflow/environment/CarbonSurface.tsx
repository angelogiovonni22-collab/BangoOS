"use client";

import type { ReactNode } from "react";

type CarbonSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function CarbonSurface({ children, className }: CarbonSurfaceProps) {
  return <div className={["bf-material-surface bf-material-carbon", className || ""].filter(Boolean).join(" ")}>{children}</div>;
}
