import Link from "next/link";
import { EmptyState, getButtonClassName } from "@/components/ui";

export function EstimateDirectoryEmptyState() {
  return (
    <EmptyState
      icon="E"
      title="No estimates yet"
      description="Create your first estimate to begin tracking pricing and approvals."
      compact
      action={(
        <Link href="/estimates/new" className={getButtonClassName({ variant: "primary", size: "lg" })}>
          New Estimate
        </Link>
      )}
    />
  );
}

export function EstimateDirectoryFilteredEmptyState() {
  return (
    <EmptyState
      icon="?"
      title="No estimates match your filters"
      description="Try clearing search or changing status, customer, project, or date filters."
      compact
    />
  );
}
