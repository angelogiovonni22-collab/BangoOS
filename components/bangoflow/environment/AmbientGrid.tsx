"use client";

import type { WorkspaceIdentity } from "./WorkspaceEnvironment";

type AmbientGridProps = {
  workspace: WorkspaceIdentity;
};

export function AmbientGrid({ workspace }: AmbientGridProps) {
  return <div aria-hidden="true" className="bf-env-grid" data-bf-workspace={workspace} />;
}
