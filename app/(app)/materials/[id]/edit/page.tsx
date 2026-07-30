import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { EditMaterialClient } from "./material-edit-client";

export default async function EditMaterialPage() {
  await requireMaterialsAccess();
  return <EditMaterialClient />;
}
