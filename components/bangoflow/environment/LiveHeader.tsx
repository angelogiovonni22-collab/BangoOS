"use client";

import type { WorkspaceIdentity, WorkspaceReactionPhase } from "./WorkspaceEnvironment";

type LiveHeaderProps = {
  workspace: WorkspaceIdentity;
  moduleLabel: string;
  departmentLabel: string;
  phase: WorkspaceReactionPhase;
};

export function LiveHeader({ workspace, moduleLabel, departmentLabel, phase }: LiveHeaderProps) {
  const title = getWorkspaceTitle(workspace);
  const stateLabel = getStateLabel(phase);

  return (
    <div className="bf-live-header" data-bf-workspace={workspace} data-bf-phase={phase}>
      <div className="bf-live-header-mark" aria-hidden="true" />
      <div className="bf-live-header-content">
        <p className="bf-live-header-title">{title}</p>
        <p className="bf-live-header-meta">{departmentLabel} / {moduleLabel}</p>
      </div>
      <span className="bf-live-header-state" aria-live="polite">{stateLabel}</span>
    </div>
  );
}

function getWorkspaceTitle(workspace: WorkspaceIdentity) {
  if (workspace === "mission-control") {
    return "Operations Overview Workspace";
  }

  if (workspace === "blueprint") {
    return "Blueprint Workspace";
  }

  if (workspace === "relationship") {
    return "Relationship Workspace";
  }

  if (workspace === "executive") {
    return "Executive Workspace";
  }

  return "Camera Workspace";
}

function getStateLabel(phase: WorkspaceReactionPhase) {
  if (phase === "navigation") {
    return "Routing";
  }

  if (phase === "data") {
    return "Syncing";
  }

  if (phase === "ai") {
    return "AI Active";
  }

  if (phase === "alert") {
    return "Alert";
  }

  return "Stable";
}
