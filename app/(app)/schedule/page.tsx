import { SchedulingDashboard } from "@/components/scheduling";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  return <SchedulingDashboard initialSection="calendar" workspace="schedule" initialProjectId={projectId} />;
}
