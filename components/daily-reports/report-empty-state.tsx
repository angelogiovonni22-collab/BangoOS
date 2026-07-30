import Link from "next/link";
import { EmptyState } from "@/components/ui";

type ReportEmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
};

export function ReportEmptyState({ title, description, actionLabel }: ReportEmptyStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <Link
          href="/daily-reports/new"
          className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white"
        >
          {actionLabel}
        </Link>
      }
      compact
    />
  );
}
