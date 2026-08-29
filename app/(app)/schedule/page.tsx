import { redirect } from "next/navigation";
import { SchedulingDashboard } from "@/components/scheduling";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ projectId?: string; project?: string }> }) {
  const supabase = await createClient();
  if (supabase) {
    const workspace = await resolveWorkspaceContext(supabase);
    if ((workspace.context?.role || "").toLowerCase() === "subcontractor") redirect("/partner/schedule");
  }

  const { projectId, project } = await searchParams;
  return <SchedulingDashboard initialSection="calendar" workspace="schedule" initialProjectId={projectId || project} />;
}
