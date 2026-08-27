import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { FulfillmentCommandCenter } from "./fulfillment-command-center";
import { ProcurementWorkflowClient } from "./procurement-workflow-client";

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  await requireMaterialsAccess();
  const { projectId } = await searchParams;
  return (
    <div className="space-y-[var(--space-section)]">
      <FulfillmentCommandCenter />
      <ProcurementWorkflowClient initialProjectId={projectId} />
    </div>
  );
}
