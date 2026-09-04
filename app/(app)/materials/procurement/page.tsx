import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { FulfillmentCommandCenter } from "./fulfillment-command-center";
import { ProcurementWorkflowClient } from "./procurement-workflow-client";
import { PurchasingExecutionClient } from "./purchasing-execution-client";
import { RetailerIntegrationStatus } from "./retailer-integration-status";

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  await requireMaterialsAccess();
  const { projectId } = await searchParams;
  return (
    <div className="space-y-[var(--space-section)]">
      <FulfillmentCommandCenter />
      <RetailerIntegrationStatus />
      {projectId ? <PurchasingExecutionClient projectId={projectId} /> : null}
      <ProcurementWorkflowClient initialProjectId={projectId} />
    </div>
  );
}
