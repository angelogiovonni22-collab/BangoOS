import type { ReactNode } from "react";
import { Card, CardContent } from "./card";

type SummaryCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  trend?: ReactNode;
};

export function SummaryCard({ icon, label, value, trend }: SummaryCardProps) {
  return (
    <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]">
      <CardContent className="flex h-full min-h-[156px] flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
            {icon}
          </div>
          {trend ? <div className="text-xs font-semibold text-[var(--color-text-muted)]">{trend}</div> : null}
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
