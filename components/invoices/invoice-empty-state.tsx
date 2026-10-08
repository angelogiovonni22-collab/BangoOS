import Link from "next/link";
import { EmptyState, getButtonClassName } from "@/components/ui";

export function InvoiceDirectoryEmptyState({ canManage }: { canManage: boolean }) {
  return (
    <div className="p-6">
      <EmptyState
        icon="$"
        title="No invoices yet"
        description={canManage ? "Create your first invoice to start tracking receivables and payment history." : "No invoices have been recorded yet."}
        action={canManage ? <Link href="/invoices/new" className={getButtonClassName({ size: "md" })}>Create Invoice</Link> : undefined}
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
