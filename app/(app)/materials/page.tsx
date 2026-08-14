import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { MaterialsListClient } from "./materials-list-client";

export default async function MaterialsPage() {
  await requireMaterialsAccess();
  return <MaterialsListClient />;
}
