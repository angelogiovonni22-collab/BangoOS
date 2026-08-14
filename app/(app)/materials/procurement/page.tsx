import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { ProcurementWorkflowClient } from "./procurement-workflow-client";

export default async function ProcurementPage() {
  await requireMaterialsAccess();
  return <ProcurementWorkflowClient />;
}
