"use client";

import { useParams } from "next/navigation";
import { InvoiceForm } from "@/components/invoices";

export default function EditInvoicePage() {
  const params = useParams<{ id?: string | string[] }>();
  const invoiceId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!invoiceId) {
    return null;
  }

  return <InvoiceForm mode="edit" invoiceId={invoiceId} />;
}
