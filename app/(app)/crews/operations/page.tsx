"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { WorkforceOperationsDashboard } from "@/components/crews";

export default function CrewOperationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="CrewOS Operations"
        description="Live workforce operations dashboard for staffing, allocation, labor, and risk."
      />
      <div>
        <Link href="/crews/field" className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
          Open Mobile Field Operations
        </Link>
      </div>
      <WorkforceOperationsDashboard />
    </div>
  );
}
