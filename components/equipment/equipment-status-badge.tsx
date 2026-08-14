import { Badge } from "@/components/ui";
import type { EquipmentStatus } from "@/lib/equipment";

const toneByStatus: Record<EquipmentStatus, "brand" | "warning" | "danger" | "neutral" | "info"> = {
  active: "brand",
  inactive: "neutral",
  maintenance: "warning",
  out_of_service: "danger",
  retired: "neutral",
  sold: "info",
  lost: "danger",
  stolen: "danger",
};

export function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  return <Badge tone={toneByStatus[status] || "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
