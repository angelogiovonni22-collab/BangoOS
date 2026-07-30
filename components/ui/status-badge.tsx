import { Badge } from "./badge";
import { getEnterpriseStatusTone, type EnterpriseStatusTone } from "@/lib/design-system/tokens";

const incidentStatusTone: EnterpriseStatusTone = "danger";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.trim().toLowerCase();
  const tone = normalizedStatus === "incident" ? incidentStatusTone : getEnterpriseStatusTone(normalizedStatus);

  return <Badge tone={tone} className={className}>{status}</Badge>;
}