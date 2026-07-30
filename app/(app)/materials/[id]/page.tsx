import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { MaterialDetailClient } from "./material-detail-client";

export default async function MaterialDetailPage() {
  await requireMaterialsAccess();
  return <MaterialDetailClient />;
}
