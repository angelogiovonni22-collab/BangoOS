"use client";

import { useParams } from "next/navigation";
import { EstimateForm } from "@/components/estimates";

export default function EditEstimatePage() {
  const params = useParams<{ id?: string | string[] }>();
  const estimateId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!estimateId) {
    return null;
  }

  return <EstimateForm mode="edit" estimateId={estimateId} />;
}
