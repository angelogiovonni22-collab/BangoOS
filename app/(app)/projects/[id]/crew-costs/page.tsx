"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, PageHeader } from "@/components/ui";
import { ProjectCrewCompensationWorkspace } from "@/components/projects/workspace";

export default function ProjectCrewCostsPage(){
  const params=useParams<{id:string}>();
  const projectId=String(params?.id||"");
  return <div className="container-content space-y-5">
    <PageHeader compact eyebrow="PROJECT · WORKFORCE" title="Project Workforce & Agreements" description="Review employee and crew assignments, labor totals, and subcontractor compensation agreements." primaryAction={<Link href={`/projects/${projectId}`}><Button variant="outline">Back to Project</Button></Link>}/>
    <ProjectCrewCompensationWorkspace projectId={projectId} localeTag="en-US"/>
  </div>;
}
