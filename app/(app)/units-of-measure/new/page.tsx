import { requireUnitsOfMeasureAccess } from "@/lib/units-of-measure/server-access";
import { UnitNewClient } from "./unit-new-client";

export default async function NewUnitOfMeasurePage() {
  await requireUnitsOfMeasureAccess();
  return <UnitNewClient />;
}
