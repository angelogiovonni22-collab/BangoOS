import { EmptyState } from "./empty-state";

type PermissionStateProps = {
  title: string;
  description: string;
};

export function PermissionState({ title, description }: PermissionStateProps) {
  return <EmptyState compact icon="!" title={title} description={description} />;
}