"use client";

import { useParams } from "next/navigation";
import { InvoicePrintView } from "@/components/invoices";

export default function InvoicePrintPage() {
  const params = useParams<{ id?: string | string[] }>();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!invoiceId) {
    return null;
  }

  return <InvoicePrintView invoiceId={invoiceId} />;
}
