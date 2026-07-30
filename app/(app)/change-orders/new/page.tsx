"use client";

import { useSearchParams } from "next/navigation";
import { ChangeOrderForm } from "@/components/change-orders";

export default function NewChangeOrderPage() {
  const searchParams = useSearchParams();

  return (
    <ChangeOrderForm
      mode="create"
      defaultCustomerId={searchParams.get("customerId") || undefined}
      defaultProjectId={searchParams.get("projectId") || undefined}
      defaultEstimateId={searchParams.get("estimateId") || undefined}
    />
  );
}
