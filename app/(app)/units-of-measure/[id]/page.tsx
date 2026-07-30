import { requireUnitsOfMeasureAccess } from "@/lib/units-of-measure/server-access";
import { UnitDetailClient } from "./unit-detail-client";

export default async function UnitOfMeasureDetailPage() {
  await requireUnitsOfMeasureAccess();
  return <UnitDetailClient />;
}
