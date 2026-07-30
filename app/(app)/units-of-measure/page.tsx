import { requireUnitsOfMeasureAccess } from "@/lib/units-of-measure/server-access";
import { UnitsListClient } from "./units-list-client";

export default async function UnitsOfMeasurePage() {
  await requireUnitsOfMeasureAccess();
  return <UnitsListClient />;
}
