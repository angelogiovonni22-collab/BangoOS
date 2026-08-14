import { Badge } from "@/components/ui";
import { getEstimateStatusBadgeClass } from "@/lib/estimates/statuses";

export function EstimateStatusBadge({ label, status }: { label: string; status: string }) {
  return <Badge className={getEstimateStatusBadgeClass(status)}>{label}</Badge>;
}

export function formatEstimateStatusLabel(status: string) {
  return status
    .split("_")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
