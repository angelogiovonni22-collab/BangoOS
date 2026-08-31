import { SchedulingDashboard } from "@/components/scheduling";

export default async function DispatchCenterPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  return <SchedulingDashboard initialSection="dispatch" workspace="dispatch" initialProjectId={projectId} />;
}
