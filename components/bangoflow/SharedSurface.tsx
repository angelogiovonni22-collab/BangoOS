"use client";

import type { ReactNode } from "react";

type SharedSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function SharedSurface({ children, className }: SharedSurfaceProps) {
  return <div className={["bf-shared-surface", className || ""].filter(Boolean).join(" ")}>{children}</div>;
}