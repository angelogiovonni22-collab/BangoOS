"use client";

import type { ReactNode } from "react";

type BlueprintSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function BlueprintSurface({ children, className }: BlueprintSurfaceProps) {
  return <div className={["bf-material-surface bf-material-blueprint", className || ""].filter(Boolean).join(" ")}>{children}</div>;
}
