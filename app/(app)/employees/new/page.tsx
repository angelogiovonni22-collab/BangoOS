"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, PartialDataNotice } from "@/components/ui";

export default function NewEmployeePage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Employee records" description="CrewOS Phase 1 is read-only." />
      <PartialDataNotice message="Employee create and edit workflows are intentionally unavailable in Phase 1 live data integration." />
      <Card>
        <CardHeader>
          <CardTitle>Read-only phase</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/employees" className="text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
            Return to employee directory
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
