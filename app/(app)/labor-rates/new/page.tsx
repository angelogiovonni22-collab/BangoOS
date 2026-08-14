import { requireLaborRatesAccess } from "@/lib/labor-rates/server-access";
import { LaborRateNewClient } from "./labor-rate-new-client";

export default async function NewLaborRatePage() {
  await requireLaborRatesAccess();
  return <LaborRateNewClient />;
}
