"use client";

import type { ReactNode } from "react";
import { useMotionPreferences } from "@/components/motion";
import { useSpatialNavigation } from "./SpatialNavigationProvider";

type CameraControllerProps = {
  children: ReactNode;
};

export function resolveCameraClassName(surfaceKind: ReturnType<typeof useSpatialNavigation>["surfaceKind"], reducedMotion: boolean) {
  return [
    "bf-camera-controller",
    `bf-camera-${surfaceKind}`,
    reducedMotion ? "bf-no-motion" : "",
  ].filter(Boolean).join(" ");
}

export function CameraController({ children }: CameraControllerProps) {
  const { surfaceKind, moduleKey, department } = useSpatialNavigation();
  const { reducedMotion } = useMotionPreferences();

  return (
    <div
      className={resolveCameraClassName(surfaceKind, reducedMotion)}
      data-surface-kind={surfaceKind}
      data-module-key={moduleKey}
      data-department={department}
    >
      {children}
    </div>
  );
}