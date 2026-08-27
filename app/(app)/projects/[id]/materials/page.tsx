import Link from "next/link";
import { BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui";
import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { ProjectMaterialPlanClient } from "./project-material-plan-client";

export default async function ProjectMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMaterialsAccess();
  const { id } = await params;
  return <div className="space-y-3">
    <div className="container-content flex justify-end">
      <Link href={`/projects/${id}/materials/compare`}><Button variant="outline"><BadgeDollarSign size={16}/>Compare supplier prices</Button></Link>
    </div>
    <ProjectMaterialPlanClient projectId={id} />
  </div>;
}
