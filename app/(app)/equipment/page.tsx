import { requireEquipmentAccess } from "@/lib/equipment/server-access";
import { EquipmentListClient } from "./equipment-list-client";

export default async function EquipmentPage() {
  await requireEquipmentAccess();
  return <EquipmentListClient />;
}
