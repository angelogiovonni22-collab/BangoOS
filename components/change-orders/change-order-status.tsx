import { StatusBadge } from "@/components/ui";
import { formatChangeOrderStatusLabel } from "@/lib/change-orders/statuses";

type ChangeOrderStatusBadgeProps = {
  status: string;
  className?: string;
};

export function ChangeOrderStatusBadge({ status, className }: ChangeOrderStatusBadgeProps) {
  return <StatusBadge status={formatChangeOrderStatusLabel(status)} className={className} />;
}
