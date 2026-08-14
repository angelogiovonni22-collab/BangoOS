"use client";

import type { ReactNode } from "react";

type GlassSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function GlassSurface({ children, className }: GlassSurfaceProps) {
  return <div className={["bf-material-surface bf-material-glass", className || ""].filter(Boolean).join(" ")}>{children}</div>;
}
