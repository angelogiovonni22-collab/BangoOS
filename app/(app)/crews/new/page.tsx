"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, PartialDataNotice } from "@/components/ui";

export default function NewCrewPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Crew records" description="CrewOS Phase 1 is read-only." />
      <PartialDataNotice message="Crew create and edit workflows are intentionally unavailable in Phase 1 live data integration." />
      <Card>
        <CardHeader>
          <CardTitle>Read-only phase</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/crews" className="text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
            Return to crew directory
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
