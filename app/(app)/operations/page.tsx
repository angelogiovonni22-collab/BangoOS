"use client";

import { WorkforceOperationsDashboard } from "@/components/crews";
import { CompanyFinancialReportingPanel } from "@/components/operations";
import { PageHeader } from "@/components/ui";

export default function OperationsPage() {
  return (
    <div className="container-page space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow="Operations"
        title="Operations Command Center"
        description="Monitor company financial reporting and workforce operations from a single control surface."
      />
      <CompanyFinancialReportingPanel />
      <WorkforceOperationsDashboard />
    </div>
  );
}
