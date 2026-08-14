import Link from "next/link";
import { Button, EmptyState } from "@/components/ui";

export function ChangeOrderDirectoryEmptyState() {
  return (
    <EmptyState
      icon="CO"
      title="No change orders yet"
      description="Create your first change order to track scope, schedule, and financial impacts."
      action={
        <Link href="/change-orders/new">
          <Button>Create Change Order</Button>
        </Link>
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
