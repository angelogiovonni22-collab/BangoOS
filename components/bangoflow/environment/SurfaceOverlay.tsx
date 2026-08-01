"use client";

import type { WorkspaceIdentity } from "./WorkspaceEnvironment";

type SurfaceOverlayProps = {
  workspace: WorkspaceIdentity;
};

export function SurfaceOverlay({ workspace }: SurfaceOverlayProps) {
  return <div aria-hidden="true" className="bf-env-overlay" data-bf-workspace={workspace} />;
}
