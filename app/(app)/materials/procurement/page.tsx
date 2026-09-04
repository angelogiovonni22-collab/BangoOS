import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { getServerLocale } from "@/lib/i18n/server";
import { FulfillmentCommandCenter } from "./fulfillment-command-center";
import { ProcurementWorkflowClient } from "./procurement-workflow-client";
import { PurchasingExecutionClient } from "./purchasing-execution-client";
import { RetailerIntegrationStatus } from "./retailer-integration-status";

export default async function ProcurementPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  await requireMaterialsAccess();
  const [{ projectId }, locale] = await Promise.all([searchParams, getServerLocale()]);
  return (
    <div className="space-y-[var(--space-section)]">
      <FulfillmentCommandCenter />
      <RetailerIntegrationStatus locale={locale} />
      {projectId ? <PurchasingExecutionClient projectId={projectId} /> : null}
      <ProcurementWorkflowClient initialProjectId={projectId} />
    </div>
  );
}