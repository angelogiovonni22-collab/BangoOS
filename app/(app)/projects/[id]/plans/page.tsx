import { redirect } from "next/navigation";

type ProjectPlansRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPlansRedirectPage({ params }: ProjectPlansRedirectPageProps) {
  const { id } = await params;
  redirect(`/projects/${id}?tab=plans`);
}
