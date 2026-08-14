import type { ReactNode } from "react";

type FilterToolbarProps = {
  children: ReactNode;
  className?: string;
  gridClassName?: string;
  footer?: ReactNode;
};

export function FilterToolbar({ children, className, gridClassName, footer }: FilterToolbarProps) {
  const sectionClassName = [
    "rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-medium)]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  const controlsClassName = ["grid gap-[var(--grid-gap-compact)]", gridClassName || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <div className={controlsClassName}>{children}</div>
      {footer ? <div className="mt-3">{footer}</div> : null}
    </section>
  );
}
