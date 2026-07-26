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
    <Card as="section" className="overflow-hidden">
      <CardHeader>
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
