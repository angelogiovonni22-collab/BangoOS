import Link from "next/link";
import { Eye, MoreHorizontal } from "lucide-react";
import { IconButton } from "@/components/ui";

export const PROJECT_HUB_SECTIONS = [
  "overview",
  "daily_reports",
  "scheduling",
  "employees",
  "crews",
  "equipment",
  "safety",
  "plans",
  "rfis",
  "submittals",
  "invoices",
  "estimates",
  "ai_insights",
] as const;

export type ProjectHubSection = (typeof PROJECT_HUB_SECTIONS)[number];

type ProjectActionsProps = {
  projectId: string;
  viewLabel: string;
  moreLabel: string;
  comingSoonLabel: string;
};

export function ProjectActions({
  projectId,
  viewLabel,
  moreLabel,
  comingSoonLabel,
}: ProjectActionsProps) {
  return (
    <div className="inline-flex items-center gap-1">
      <Link href={`/projects/${projectId}`}>
        <IconButton
          icon={<Eye size={15} aria-hidden="true" />}
          label={viewLabel}
          variant="ghost"
          size="sm"
        />
      </Link>

      <IconButton
        icon={<MoreHorizontal size={15} aria-hidden="true" />}
        label={moreLabel}
        variant="ghost"
        size="sm"
        disabled
        aria-disabled="true"
        title={comingSoonLabel}
      />
    </div>
  );
}
