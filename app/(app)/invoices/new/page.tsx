"use client";

import { useSearchParams } from "next/navigation";
import { InvoiceForm } from "@/components/invoices";

export default function NewInvoicePage() {
  const searchParams = useSearchParams();

  return (
    <InvoiceForm
      mode="create"
      defaultCustomerId={searchParams.get("customerId") || undefined}
      defaultProjectId={searchParams.get("projectId") || undefined}
      defaultEstimateId={searchParams.get("estimateId") || undefined}
    />
  );
}
