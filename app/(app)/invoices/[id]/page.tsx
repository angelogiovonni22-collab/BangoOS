"use client";

import { useParams } from "next/navigation";
import { InvoiceDetail } from "@/components/invoices";

export default function InvoiceDetailsPage() {
  const params = useParams<{ id?: string | string[] }>();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!invoiceId) {
    return null;
  }

  return <InvoiceDetail invoiceId={invoiceId} />;
}
