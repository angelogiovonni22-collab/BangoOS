import { requireEquipmentAccess } from "@/lib/equipment/server-access";
import { EquipmentEditClient } from "./equipment-edit-client";

export default async function EditEquipmentPage() {
  await requireEquipmentAccess();
  return <EquipmentEditClient />;
}
