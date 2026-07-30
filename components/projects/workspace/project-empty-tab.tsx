import { EmptyState } from "@/components/ui";

type ProjectEmptyTabProps = {
  title: string;
  description: string;
  tabLabel: string;
};

export function ProjectEmptyTab({ title, description, tabLabel }: ProjectEmptyTabProps) {
  return <EmptyState compact icon="P" title={title} description={description + ` ${tabLabel}.`} />;
}
