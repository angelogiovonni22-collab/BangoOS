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
      <CardHeader className="bg-[var(--color-primary-50)]/35 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {controls ? <div className="w-full lg:w-auto">{controls}</div> : null}
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}
