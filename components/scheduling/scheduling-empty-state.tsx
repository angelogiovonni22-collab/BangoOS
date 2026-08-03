import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { Calendar } from "./scheduling-icons";

type SchedulingEmptyStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  href: string;
};

export function SchedulingEmptyState({ title, description, actionLabel, href }: SchedulingEmptyStateProps) {
  return (
    <EmptyState
      icon={<Calendar className="h-7 w-7" />}
      title={title}
      description={description}
      action={
        <Link
          href={href}
          className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white"
        >
          {actionLabel}
        </Link>
      }
    />
  );
}
