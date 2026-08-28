"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, PageHeader } from "@/components/ui";
import { ProjectCrewCompensationWorkspace } from "@/components/projects/workspace";

export default function ProjectCrewCostsPage(){
  const params=useParams<{id:string}>();
  const projectId=String(params?.id||"");
  return <div className="container-content space-y-5">
    <PageHeader compact eyebrow="PROJECT · WORKFORCE" title="Crew & Trade Partner Costs" description="See who is assigned to this project, how each employee, crew, or subcontractor is being paid, projected commitments, and approved-time actual labor." actions={<Link href={`/projects/${projectId}`}><Button variant="outline">Back to Project</Button></Link>}/>
    <ProjectCrewCompensationWorkspace projectId={projectId} localeTag="en-US"/>
  </div>;
}
