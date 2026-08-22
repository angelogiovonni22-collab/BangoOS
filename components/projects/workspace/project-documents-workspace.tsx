"use client";

import { useSearchParams } from "next/navigation";
import { ProjectLinkedModuleWorkspace } from "./project-linked-module-workspace";
import { ProjectReceiptsWorkspace } from "./project-receipts-workspace";

type ProjectDocumentsWorkspaceProps = {
  projectId: string;
  localeTag: string;
};

export function ProjectDocumentsWorkspace({ projectId, localeTag }: ProjectDocumentsWorkspaceProps) {
  const searchParams = useSearchParams();
  const showReceipts = searchParams.get("section") === "receipts";

  return showReceipts ? (
    <ProjectReceiptsWorkspace projectId={projectId} />
  ) : (
    <ProjectLinkedModuleWorkspace projectId={projectId} tab="documents" localeTag={localeTag} />
  );
}
