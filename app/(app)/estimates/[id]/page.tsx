"use client";

import { useParams } from "next/navigation";
import { EstimateDetail } from "@/components/estimates";
import { EstimateComplianceSection } from "@/components/estimates/estimate-compliance-section";

export default function EstimateDetailsPage() {
  const params = useParams<{ id?: string | string[] }>();
  const estimateId = Array.isArray(params.id) ? params.id[0] : params.id;

  if (!estimateId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <EstimateDetail estimateId={estimateId} />
      <EstimateComplianceSection estimateId={estimateId} />
    </div>
  );
}
