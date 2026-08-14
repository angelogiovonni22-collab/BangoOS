import { requireCostCodesAccess } from "@/lib/cost-codes/server-access";
import { EditCostCodeClient } from "./cost-code-edit-client";

export default async function EditCostCodePage() {
  await requireCostCodesAccess();
  return <EditCostCodeClient />;
}
