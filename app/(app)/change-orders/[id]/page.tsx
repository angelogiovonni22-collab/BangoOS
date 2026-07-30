"use client";

import { useParams } from "next/navigation";
import { ChangeOrderDetail } from "@/components/change-orders";

export default function ChangeOrderDetailsPage() {
  const params = useParams<{ id?: string | string[] }>();
  const changeOrderId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!changeOrderId) {
    return null;
  }

  return <ChangeOrderDetail changeOrderId={changeOrderId} />;
}
