"use client";

import type { WorkspaceIdentity, WorkspaceReactionPhase } from "./WorkspaceEnvironment";

type LightingSystemProps = {
  workspace: WorkspaceIdentity;
  phase: WorkspaceReactionPhase;
};

export function LightingSystem({ workspace, phase }: LightingSystemProps) {
  return <div aria-hidden="true" className="bf-env-lighting" data-bf-workspace={workspace} data-bf-phase={phase} />;
}
