import { requireLaborRatesAccess } from "@/lib/labor-rates/server-access";
import { LaborRateEditClient } from "./labor-rate-edit-client";

export default async function EditLaborRatePage() {
  await requireLaborRatesAccess();
  return <LaborRateEditClient />;
}
