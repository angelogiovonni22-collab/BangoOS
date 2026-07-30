import { StatusBadge } from "@/components/ui";
import { formatInvoiceStatusLabel } from "@/lib/invoices/statuses";

type InvoiceStatusBadgeProps = {
  status: string;
  className?: string;
};

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  return <StatusBadge status={formatInvoiceStatusLabel(status)} className={className} />;
}
