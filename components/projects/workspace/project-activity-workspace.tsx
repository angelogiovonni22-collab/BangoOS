"use client";

import { ProjectTimeline } from "@/components/project-intelligence";

type ProjectActivityWorkspaceProps = {
  projectId: string;
  localeTag: string;
  currentUserId: string;
  currentUserName: string;
};

export function ProjectActivityWorkspace({
  projectId,
  localeTag,
  currentUserId,
  currentUserName,
}: ProjectActivityWorkspaceProps) {
  return (
    <ProjectTimeline
      projectId={projectId}
      localeTag={localeTag}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
    />
  );
}
