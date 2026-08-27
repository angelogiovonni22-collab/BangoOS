import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { ProjectSupplierComparisonClient } from "./project-supplier-comparison-client";

export default async function ProjectSupplierComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMaterialsAccess();
  const { id } = await params;
  return <ProjectSupplierComparisonClient projectId={id} />;
}
