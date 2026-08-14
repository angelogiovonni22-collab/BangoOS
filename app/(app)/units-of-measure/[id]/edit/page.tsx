import { requireUnitsOfMeasureAccess } from "@/lib/units-of-measure/server-access";
import { UnitEditClient } from "./unit-edit-client";

export default async function EditUnitOfMeasurePage() {
  await requireUnitsOfMeasureAccess();
  return <UnitEditClient />;
}
