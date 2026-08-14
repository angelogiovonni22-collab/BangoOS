"use client";

import { useParams } from "next/navigation";
import { ChangeOrderPrintView } from "@/components/change-orders";

export default function ChangeOrderPrintPage() {
  const params = useParams<{ id?: string | string[] }>();
  const changeOrderId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!changeOrderId) {
    return null;
  }

  return <ChangeOrderPrintView changeOrderId={changeOrderId} />;
}
