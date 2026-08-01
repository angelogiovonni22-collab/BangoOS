"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, PartialDataNotice } from "@/components/ui";

export default function EditCrewPage() {
  const params = useParams<{ id?: string | string[] }>();
  const crewId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";

  return (
    <div className="space-y-8">
      <PageHeader title="Crew records" description="CrewOS Phase 1 is read-only." />
      <PartialDataNotice message="Crew create and edit workflows are intentionally unavailable in Phase 1 live data integration." />
      <Card>
        <CardHeader>
          <CardTitle>Read-only phase</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href={crewId ? `/crews/${crewId}` : "/crews"} className="text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
            Return to crew profile
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
