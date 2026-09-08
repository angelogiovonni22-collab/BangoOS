"use client";

import { useEffect } from "react";
import { Minimize2 } from "lucide-react";
import { Button } from "@/components/ui";
import { Blueprint2dViewer } from "./blueprint-2d-viewer";
import { Blueprint3dViewer } from "./blueprint-3d-viewer";
import type { PlanDocument } from "./types";

type BlueprintPlanWorkspaceProps = {
  open: boolean;
  onClose: () => void;
  document: PlanDocument;
  projectName: string;
  companyId: string;
  projectId: string;
  userId: string;
  previewType: "image" | "pdf" | "ifc" | "gltf";
  initialPage?: number;
  initialAnnotationId?: string | null;
};

export function BlueprintPlanWorkspace({
  open,
  onClose,
  document: planDocument,
  companyId,
  projectId,
  userId,
  previewType,
  initialPage = 1,
  initialAnnotationId,
}: BlueprintPlanWorkspaceProps) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !planDocument.fileUrl) return null;

  const is3d = previewType === "ifc" || previewType === "gltf";

  return (
    <div
      className="fixed inset-0 z-[120] h-dvh w-screen overflow-hidden bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label={`Plan workspace for ${planDocument.fileName}`}
      data-orion-region="blueprint-plan-workspace"
    >
      {is3d ? (
        <>
          <Blueprint3dViewer
            fileUrl={planDocument.fileUrl}
            fileName={planDocument.fileName}
            format={previewType}
            companyId={companyId}
            projectId={projectId}
            versionId={planDocument.versionId}
            userId={userId}
          />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={onClose}
            aria-label="Exit full-page plan workspace"
            title="Exit full-page plan workspace"
            className="fixed bottom-4 right-4 z-[130] shadow-xl"
          >
            <Minimize2 size={18} aria-hidden="true" />
          </Button>
        </>
      ) : (
        <Blueprint2dViewer
          key={`workspace:${planDocument.versionId}`}
          fileUrl={planDocument.fileUrl}
          fileName={planDocument.fileName}
          previewType={previewType}
          companyId={companyId}
          projectId={projectId}
          versionId={planDocument.versionId}
          userId={userId}
          discipline={planDocument.discipline}
          expanded
          initialPage={initialPage}
          initialAnnotationId={initialAnnotationId}
          onClose={onClose}
        />
      )}
    </div>
  );
}
