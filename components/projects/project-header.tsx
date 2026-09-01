import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Button, PageHeader, getButtonClassName } from "@/components/ui";

type ProjectHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  newProjectLabel: string;
  importLabel: string;
  comingSoonLabel: string;
};

export function ProjectHeader({
  eyebrow,
  title,
  description,
  newProjectLabel,
  importLabel,
  comingSoonLabel,
}: ProjectHeaderProps) {
  return (
    <PageHeader
      compact
      eyebrow={eyebrow}
      title={title}
      description={description}
      secondaryActions={(
        <Button variant="secondary" size="md" disabled aria-disabled="true" title={comingSoonLabel}>
          <Upload size={16} aria-hidden="true" />
          {importLabel}
        </Button>
      )}
      primaryAction={(
        <Link href="/projects/new" className={getButtonClassName({ size: "md" })}>
          <Plus size={16} aria-hidden="true" />
          {newProjectLabel}
        </Link>
      )}
    />
  );
}
