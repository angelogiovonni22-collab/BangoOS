"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { ProjectMeasureWorkspace } from "@/components/projects/workspace/project-measure-workspace";
import { Button } from "@/components/ui";
import { WorkspaceShell } from "@/components/workspace";

export default function ProjectMeasurePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  return <WorkspaceShell>
    <div className="mb-4 flex items-center justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--bos-text-medium-on-light)]">Project Field Tool</p><h1 className="text-2xl font-bold text-[var(--bos-text-strong-on-light)]">Measure</h1></div>
      <Link href={`/projects/${projectId}`}><Button type="button" variant="secondary"><ArrowLeft size={16}/> Back to Project</Button></Link>
    </div>
    <ProjectMeasureWorkspace projectId={projectId} projectName="Project" />
  </WorkspaceShell>;
}
