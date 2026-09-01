import Link from "next/link";
import { EmptyState, getButtonClassName } from "@/components/ui";

export function InvoiceDirectoryEmptyState() {
  return (
    <div className="p-6">
      <EmptyState
        icon="$"
        title="No invoices yet"
        description="Create your first invoice to start tracking receivables and payment history."
        action={<Link href="/invoices/new" className={getButtonClassName({ size: "md" })}>Create Invoice</Link>}
      />
    </div>
  );
}

export function InvoiceDirectoryFilteredEmptyState() {
  return (
    <div className="p-6">
      <EmptyState
        compact
        icon="?"
        title="No invoices match these filters"
        description="Try adjusting search terms, filters, or date range to find records."
      />
    </div>
  );
}
