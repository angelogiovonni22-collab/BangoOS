import { requireMaterialsAccess } from "@/lib/materials/server-access";
import { NewMaterialClient } from "./material-new-client";

export default async function NewMaterialPage() {
  await requireMaterialsAccess();
  return <NewMaterialClient />;
}
