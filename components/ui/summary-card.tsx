import type { ReactNode } from "react";
import { Card, CardContent } from "./card";

type SummaryCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  context?: string;
  tone?: "brand" | "success" | "successLight" | "successDark" | "warning" | "sent" | "danger" | "info" | "neutral" | "analytics";
  trend?: ReactNode;
  compact?: boolean;
  onClick?: () => void;
  selected?: boolean;
  actionLabel?: string;
};

export function SummaryCard({ icon, label, value, context, tone = "brand", trend, compact = false, onClick, selected = false, actionLabel }: SummaryCardProps) {
  const toneClass: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
    brand: "bg-[var(--color-primary-600)] text-white ring-[rgb(255_255_255/0.14)]",
    success: "bg-[var(--color-success-500)] text-white ring-[rgb(255_255_255/0.14)]",
    successLight: "bg-[var(--color-success-100)] text-[var(--color-success-700)] ring-[var(--color-success-500)]/25",
    successDark: "bg-[var(--color-success-700)] text-white ring-[rgb(255_255_255/0.14)]",
    warning: "bg-[var(--color-warning-500)] text-white ring-[rgb(255_255_255/0.14)]",
    sent: "bg-[#f5b700] text-[#382700] ring-[rgb(255_255_255/0.24)]",
    danger: "bg-[var(--color-danger-500)] text-white ring-[rgb(255_255_255/0.14)]",
    info: "bg-[var(--color-info-500)] text-white ring-[rgb(255_255_255/0.14)]",
    neutral: "bg-[var(--color-neutral-700)] text-white ring-[rgb(255_255_255/0.14)]",
    analytics: "bg-[var(--color-analytics-700)] text-white ring-[rgb(255_255_255/0.14)]",
  };

  const glowClass: Record<NonNullable<SummaryCardProps["tone"]>, string> = {
    brand: "bg-[var(--color-primary-500)]",
    success: "bg-[var(--color-success-500)]",
    successLight: "bg-[var(--color-success-500)]",
    successDark: "bg-[var(--color-success-700)]",
    warning: "bg-[var(--color-warning-500)]",
    sent: "bg-[#f5b700]",
    danger: "bg-[var(--color-danger-500)]",
    info: "bg-[var(--color-info-500)]",
    neutral: "bg-[var(--color-neutral-500)]",
    analytics: "bg-[var(--color-analytics-500)]",
  };

  const card = (
    <Card
      variant="kpi"
      className={[
        "group h-full overflow-hidden border-[var(--color-border-subtle)] shadow-[var(--shadow-small)] transition-all duration-200",
        onClick ? "group-hover:-translate-y-0.5 group-hover:border-[var(--color-brand-500)] group-hover:shadow-[var(--shadow-card)]" : "",
        selected ? "border-[var(--color-brand-500)] ring-2 ring-[var(--color-brand-500)]/35" : "",
      ].filter(Boolean).join(" ")}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute -right-9 -top-9 h-28 w-28 rounded-full opacity-[0.12] blur-2xl transition-opacity duration-200 group-hover:opacity-[0.2] ${glowClass[tone]}`} />
      <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] opacity-75 ${glowClass[tone]}`} />
      <CardContent className={`relative flex h-full flex-col justify-between ${compact ? "min-h-[112px] p-3.5" : "min-h-[140px] p-4"}`}>
        <div className="flex items-start justify-between gap-4">
          <div
            className={[
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-[0_10px_18px_-14px_rgb(15_23_42/0.34)] ring-1 ring-inset transition-transform duration-200 group-hover:scale-[1.04]",
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

  if (!onClick) return card;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={actionLabel || `Filter by ${label}`}
      className="block h-full w-full rounded-[var(--radius-xl)] text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
    >
      {card}
    </button>
  );
}
