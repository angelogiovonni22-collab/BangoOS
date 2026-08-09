import type { ReactNode } from "react";
import { Card, CardContent } from "./card";

type SummaryCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  context?: string;
  tone?: "brand" | "success" | "warning" | "danger" | "info" | "neutral" | "analytics";
  trend?: ReactNode;
  compact?: boolean;
};

export function SummaryCard({ icon, label, value, context, tone = "brand", trend, compact = false }: SummaryCardProps) {
  const toneClass: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
    brand: "bg-[var(--color-primary-600)] text-white ring-[rgb(255_255_255/0.14)]",
    success: "bg-[var(--color-success-500)] text-white ring-[rgb(255_255_255/0.14)]",
    warning: "bg-[var(--color-warning-500)] text-white ring-[rgb(255_255_255/0.14)]",
    danger: "bg-[var(--color-danger-500)] text-white ring-[rgb(255_255_255/0.14)]",
    info: "bg-[var(--color-info-500)] text-white ring-[rgb(255_255_255/0.14)]",
    neutral: "bg-[var(--color-neutral-700)] text-white ring-[rgb(255_255_255/0.14)]",
    analytics: "bg-[var(--color-analytics-700)] text-white ring-[rgb(255_255_255/0.14)]",
  };

  return (
    <Card variant="kpi" className="h-full border-[var(--color-border-subtle)] shadow-[var(--shadow-small)]">
      <CardContent className={`flex h-full flex-col justify-between ${compact ? "min-h-[112px] p-3.5" : "min-h-[140px] p-4"}`}>
        <div className="flex items-start justify-between gap-4">
          <div
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[0_10px_18px_-14px_rgb(15_23_42/0.34)] ring-1 ring-inset",
              toneClass[tone],
              "[&>svg]:h-[22px] [&>svg]:w-[22px] [&>svg]:shrink-0 [&>svg]:stroke-[2.5] [&>svg]:text-white [&>svg]:fill-none [&>span]:text-[22px] [&>span]:font-semibold [&>span]:leading-none",
            ].join(" ")}
          >
            {icon}
          </div>
          {trend ? <div className="text-right text-xs font-semibold text-[var(--color-text-secondary)]">{trend}</div> : null}
        </div>

        <div className={compact ? "mt-3" : "mt-4"}>
          <p className="text-table-header text-[var(--color-text-secondary)]">{label}</p>
          <p className={`font-bold tracking-tight text-[var(--color-text-primary)] ${compact ? "mt-1.5 text-[1.5rem]" : "mt-2 text-[1.62rem]"}`}>{value}</p>
          {context ? <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">{context}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
