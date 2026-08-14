"use client";

import { PageHeader } from "@/components/ui";
import { MobileFieldOperationsWorkspace } from "@/components/crews/mobile-field-operations-workspace";

export default function CrewFieldOperationsMobilePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="CrewOS Mobile Field Operations"
        description="Mobile-first workflow for foremen and field employees."
      />
      <MobileFieldOperationsWorkspace />
    </div>
  );
}
