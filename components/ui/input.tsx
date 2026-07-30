import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function getInputClassName() {
  return "w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]";
}

export function Input({ className, ...props }: InputProps) {
  const composedClassName = [getInputClassName(), className || ""]
    .filter(Boolean)
    .join(" ");

  return <input className={composedClassName} {...props} />;
}
