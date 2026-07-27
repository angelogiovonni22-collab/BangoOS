import type { HTMLAttributes } from "react";

type BadgeTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "error";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  const toneClass: Record<BadgeTone, string> = {
    neutral: "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)] ring-[var(--color-neutral-500)]/20",
    brand: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)] ring-[var(--color-brand-500)]/20",
    info: "bg-[var(--color-info-50)] text-[var(--color-info-700)] ring-[var(--color-info-500)]/20",
    success: "bg-[var(--color-success-50)] text-[var(--color-success-700)] ring-[var(--color-success-500)]/20",
    warning: "bg-[var(--color-warning-50)] text-[var(--color-warning-700)] ring-[var(--color-warning-500)]/20",
    danger: "bg-[var(--color-danger-50)] text-[var(--color-danger-700)] ring-[var(--color-danger-500)]/20",
    error: "bg-[var(--color-danger-50)] text-[var(--color-danger-700)] ring-[var(--color-danger-500)]/20",
  };

  const composedClassName = [
    "inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
    toneClass[tone],
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={composedClassName} {...props} />;
}
