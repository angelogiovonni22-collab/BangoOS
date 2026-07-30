import { Badge } from "@/components/ui";
import { getEnterpriseStatusTone } from "@/lib/design-system/tokens";

type ProjectStatusBadgeProps = {
  statusKey: string;
  label: string;
};

export function ProjectStatusBadge({ statusKey, label }: ProjectStatusBadgeProps) {
  return <Badge tone={getEnterpriseStatusTone(statusKey)}>{label}</Badge>;
}
