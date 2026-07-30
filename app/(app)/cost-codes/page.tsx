import { requireCostCodesAccess } from "@/lib/cost-codes/server-access";
import { CostCodesListClient } from "./cost-codes-list-client";

export default async function CostCodesPage() {
  await requireCostCodesAccess();
  return <CostCodesListClient />;
}
