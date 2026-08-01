"use client";

import type { ReactNode } from "react";
import { WorkspaceTransition } from "./WorkspaceTransition";

type ProjectEntranceTransitionProps = {
  children: ReactNode;
  className?: string;
};

export function ProjectEntranceTransition({ children, className }: ProjectEntranceTransitionProps) {
  return (
    <WorkspaceTransition surfaceKind="workspace" className={className}>
      {children}
    </WorkspaceTransition>
  );
}