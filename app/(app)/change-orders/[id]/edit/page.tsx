"use client";

import { useParams } from "next/navigation";
import { ChangeOrderForm } from "@/components/change-orders";

export default function EditChangeOrderPage() {
  const params = useParams<{ id?: string | string[] }>();
  const changeOrderId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!changeOrderId) {
    return null;
  }

  return <ChangeOrderForm mode="edit" changeOrderId={changeOrderId} />;
}
