import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { ProjectMaterialPlanClient } from "./project-material-plan-client";

export default async function ProjectMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMaterialsAccess();
  const { id } = await params;
  return <ProjectMaterialPlanClient projectId={id} />;
}
