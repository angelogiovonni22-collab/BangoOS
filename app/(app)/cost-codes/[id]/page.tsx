import { requireCostCodesAccess } from "@/lib/cost-codes/server-access";
import { CostCodeDetailClient } from "./cost-code-detail-client";

export default async function CostCodeDetailPage() {
  await requireCostCodesAccess();
  return <CostCodeDetailClient />;
}
