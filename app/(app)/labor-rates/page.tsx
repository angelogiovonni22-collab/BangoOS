import { requireLaborRatesAccess } from "@/lib/labor-rates/server-access";
import { LaborRatesListClient } from "./labor-rates-list-client";

export default async function LaborRatesPage() {
  await requireLaborRatesAccess();
  return <LaborRatesListClient />;
}
