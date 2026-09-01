import Link from "next/link";
import { EmptyState, getButtonClassName } from "@/components/ui";

export function ChangeOrderDirectoryEmptyState() {
  return (
    <EmptyState
      icon="CO"
      title="No change orders yet"
      description="Create your first change order to track scope, schedule, and financial impacts."
      action={
        <Link href="/change-orders/new" className={getButtonClassName({})}>Create Change Order</Link>
      }
    />
  );
}

export function ChangeOrderDirectoryFilteredEmptyState() {
  return (
    <EmptyState
      icon="?"
      title="No matching change orders"
      description="Adjust filters or search terms to find existing change orders."
      compact
    />
  );
}
