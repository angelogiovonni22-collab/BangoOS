import { requireEquipmentAccess } from "@/lib/equipment/server-access";
import { EquipmentDetailClient } from "./equipment-detail-client";

export default async function EquipmentDetailPage() {
  await requireEquipmentAccess();
  return <EquipmentDetailClient />;
}
