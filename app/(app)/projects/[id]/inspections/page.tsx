import { redirect } from "next/navigation";

export default async function ProjectInspectionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${encodeURIComponent(id)}?tab=inspections`);
}
