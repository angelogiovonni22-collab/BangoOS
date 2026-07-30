import { Badge } from "@/components/ui";
import type { MaintenanceStatus } from "@/lib/equipment";

const toneByStatus: Record<MaintenanceStatus, "brand" | "warning" | "danger" | "neutral" | "info"> = {
  current: "brand",
  due_soon: "warning",
  overdue: "danger",
  in_service: "info",
  unavailable: "neutral",
  not_required: "neutral",
};

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return <Badge tone={toneByStatus[status] || "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
