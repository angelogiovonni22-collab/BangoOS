import type { HTMLAttributes, ReactNode } from "react";

type BadgeTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "error"
  | "analytics";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

function humanizeBadgeChildren(children: ReactNode) {
  if (typeof children !== "string" || !/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(children)) return children;
  return children
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  const toneClass: Record<BadgeTone, string> = {
    neutral: "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] ring-[var(--color-neutral-200)]",
    brand: "bg-[var(--color-primary-50)] text-[var(--color-brand-800)] ring-[var(--color-brand-100)]",
    info: "bg-[var(--color-info-50)] text-[var(--color-info-700)] ring-[var(--color-info-100)]",
    success: "bg-[var(--color-success-50)] text-[var(--color-success-700)] ring-[var(--color-success-100)]",
    warning: "bg-[var(--color-warning-50)] text-[var(--color-warning-700)] ring-[var(--color-warning-100)]",
    danger: "bg-[var(--color-danger-50)] text-[var(--color-danger-700)] ring-[var(--color-danger-200)]",
    error: "bg-[var(--color-danger-50)] text-[var(--color-danger-700)] ring-[var(--color-danger-200)]",
    analytics: "bg-[var(--color-analytics-50)] text-[var(--color-analytics-700)] ring-[var(--color-analytics-100)]",
  };

  const composedClassName = [
    "text-badge inline-flex items-center rounded-[var(--radius-badge)] px-3 py-1 font-semibold ring-1 ring-inset",
    toneClass[tone],
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={composedClassName} {...props}>{humanizeBadgeChildren(children)}</span>;
}
