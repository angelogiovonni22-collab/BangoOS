import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function getInputClassName() {
  return "w-full rounded-[var(--radius-lg)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-4 py-3 text-sm text-[var(--bos-text-primary)] outline-none transition placeholder:text-[var(--bos-text-muted)] focus-visible:border-[var(--orion-blue)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  const composedClassName = [getInputClassName(), className || ""]
    .filter(Boolean)
    .join(" ");

  return <input ref={ref} className={composedClassName} {...props} />;
});
