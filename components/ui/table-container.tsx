import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

type TableContainerProps = {
  title: string;
  description?: string;
  controls?: ReactNode;
  children: ReactNode;
};

export function TableContainer({
  title,
  description,
  controls,
  children,
}: TableContainerProps) {
  return (
    <Card as="section" variant="elevated" className="overflow-hidden border-[var(--color-border-subtle)]">
      <CardHeader className="bg-[var(--bos-bg-workspace-surface-soft)] px-[var(--space-card-padding)] py-4">
        <div className="flex flex-col gap-[var(--space-grid-gap)] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {controls ? <div className="w-full lg:w-auto lg:shrink-0">{controls}</div> : null}
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}
