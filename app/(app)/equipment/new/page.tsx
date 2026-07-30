import { requireEquipmentAccess } from "@/lib/equipment/server-access";
import { EquipmentNewClient } from "./equipment-new-client";

export default async function NewEquipmentPage() {
  await requireEquipmentAccess();
  return <EquipmentNewClient />;
}
