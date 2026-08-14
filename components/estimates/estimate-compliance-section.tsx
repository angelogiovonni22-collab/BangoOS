"use client";

import { useEffect, useState } from "react";
import { ContractCompliancePanel } from "./contract-compliance-panel";

export function EstimateComplianceSection({ estimateId }: { estimateId: string }) {
  const [totalAmount, setTotalAmount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/estimates/${estimateId}/compliance`, { cache: "no-store" });
        const body = await response.json();
        if (active && response.ok) setTotalAmount(Number(body.totalAmount || 0));
      } catch {
        if (active) setTotalAmount(0);
      }
    })();
    return () => { active = false; };
  }, [estimateId]);

  if (totalAmount == null) return null;
  return <ContractCompliancePanel estimateId={estimateId} totalAmount={totalAmount} />;
}
