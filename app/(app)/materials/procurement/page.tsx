import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { ProcurementWorkflowClient } from "./procurement-workflow-client";

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  await requireMaterialsAccess();
  const { projectId } = await searchParams;
  return <ProcurementWorkflowClient initialProjectId={projectId} />;
}
