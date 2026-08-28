import { SchedulingDashboard } from "@/components/scheduling";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ projectId?: string; project?: string }> }) {
  const { projectId, project } = await searchParams;
  return <SchedulingDashboard initialSection="calendar" workspace="schedule" initialProjectId={projectId || project} />;
}
