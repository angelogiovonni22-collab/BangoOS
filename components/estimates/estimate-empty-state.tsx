"use client";

import Link from "next/link";
import { EmptyState, getButtonClassName } from "@/components/ui";
import { useAdaptiveBos } from "@/lib/adaptive-bos/provider";

export function EstimateDirectoryEmptyState() {
  const { term } = useAdaptiveBos();
  const estimateLabel = term("estimate", "Estimate");
  const estimatesLabel = term("estimates", "Estimates");

  return (
    <EmptyState
      icon="E"
      title={`No ${estimatesLabel.toLowerCase()} yet`}
      description={`Create your first ${estimateLabel.toLowerCase()} to begin tracking pricing and approvals.`}
      compact
      action={(
        <Link href="/estimates/new" className={getButtonClassName({ variant: "primary", size: "lg" })}>
          New {estimateLabel}
        </Link>
      )}
    />
  );
}

export function EstimateDirectoryFilteredEmptyState() {
  const { term } = useAdaptiveBos();
  const estimatesLabel = term("estimates", "Estimates");
  const customerLabel = term("customer", "Customer");
  const projectLabel = term("project", "Project");

  return (
    <EmptyState
      icon="?"
      title={`No ${estimatesLabel.toLowerCase()} match your filters`}
      description={`Try clearing search or changing status, ${customerLabel.toLowerCase()}, ${projectLabel.toLowerCase()}, or date filters.`}
      compact
    />
  );
}
