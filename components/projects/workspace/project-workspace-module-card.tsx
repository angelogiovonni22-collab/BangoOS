import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

type ProjectWorkspaceModuleCardProps = {
  title: string;
  description: string;
  metricLabel?: string;
  metricValue?: string;
  href?: string;
  actionLabel?: string;
};

export function ProjectWorkspaceModuleCard({
  title,
  description,
  metricLabel,
  metricValue,
  href,
  actionLabel = "Open",
}: ProjectWorkspaceModuleCardProps) {
  return (
    <Card as="section" variant="elevated" className="shadow-[var(--shadow-small)]">
      <CardHeader className="bg-[var(--color-surface-subtle)]/45">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{description}</p>

        {metricLabel && metricValue ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{metricLabel}</p>
            <p className="mt-1.5 text-base font-semibold text-[var(--color-text-primary)]">{metricValue}</p>
          </div>
        ) : null}

        {href ? (
          <Link href={href} className="inline-flex">
            <Button variant="outline" size="sm">{actionLabel}</Button>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
