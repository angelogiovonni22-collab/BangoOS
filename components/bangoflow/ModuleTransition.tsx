"use client";

import type { ReactNode } from "react";
import { WorkspaceTransition } from "./WorkspaceTransition";

type ModuleTransitionProps = {
  children: ReactNode;
  className?: string;
  surfaceKind?: "mission-control" | "module";
};

export function ModuleTransition({ children, className, surfaceKind = "module" }: ModuleTransitionProps) {
  return (
    <WorkspaceTransition surfaceKind={surfaceKind} className={className}>
      {children}
    </WorkspaceTransition>
  );
}