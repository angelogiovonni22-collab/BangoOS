"use client";

import type { ReactNode } from "react";
import { PageTransition, useMotionPreferences } from "@/components/motion";
import { useSpatialNavigation, type SpatialSurfaceKind } from "./SpatialNavigationProvider";

type WorkspaceTransitionProps = {
  children: ReactNode;
  className?: string;
  surfaceKind?: SpatialSurfaceKind;
};

export function resolveWorkspaceTransitionClassName(surfaceKind: SpatialSurfaceKind) {
  return `bf-workspace-transition bf-workspace-${surfaceKind}`;
}

export function WorkspaceTransition({ children, className, surfaceKind }: WorkspaceTransitionProps) {
  const route = useSpatialNavigation();
  const { reducedMotion } = useMotionPreferences();
  const nextSurfaceKind = surfaceKind ?? route.surfaceKind;
  const composedClassName = [resolveWorkspaceTransitionClassName(nextSurfaceKind), className || ""].filter(Boolean).join(" ");

  if (reducedMotion) {
    return <div className={composedClassName}>{children}</div>;
  }

  return (
    <PageTransition transitionKey={route.transitionKey} className={composedClassName}>
      {children}
    </PageTransition>
  );
}