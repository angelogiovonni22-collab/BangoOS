import { EmptyState } from "@/components/ui";

type ProjectTimelineEmptyStateProps = {
  title: string;
  description: string;
};

export function ProjectTimelineEmptyState({ title, description }: ProjectTimelineEmptyStateProps) {
  return <EmptyState compact icon="TL" title={title} description={description} />;
}
