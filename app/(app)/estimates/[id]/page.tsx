"use client";

import { useParams } from "next/navigation";
import { EstimateDetail } from "@/components/estimates";

export default function EstimateDetailsPage() {
  const params = useParams<{ id?: string | string[] }>();
  const estimateId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!estimateId) {
    return null;
  }

  return <EstimateDetail estimateId={estimateId} />;
}
