import { EmptyState } from "@/components/ui";
import { Construction } from "./operations-icons";

type OperationsEmptyStateProps = {
  title: string;
  description: string;
};

export function OperationsEmptyState({ title, description }: OperationsEmptyStateProps) {
  return (
    <EmptyState
      icon={<Construction className="h-7 w-7" />}
      title={title}
      description={description}
    />
  );
}
