import { requireCostCodesAccess } from "@/lib/cost-codes/server-access";
import { NewCostCodeClient } from "./cost-code-new-client";

export default async function NewCostCodePage() {
  await requireCostCodesAccess();
  return <NewCostCodeClient />;
}
