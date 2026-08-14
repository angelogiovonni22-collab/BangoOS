import { requireLaborRatesAccess } from "@/lib/labor-rates/server-access";
import { LaborRateDetailClient } from "./labor-rate-detail-client";

export default async function LaborRateDetailPage() {
  await requireLaborRatesAccess();
  return <LaborRateDetailClient />;
}
