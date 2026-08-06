import type { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function getSelectClassName() {
  return "w-full rounded-[var(--radius-lg)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-4 py-3 text-sm text-[var(--bos-text-primary)] outline-none transition focus-visible:border-[var(--orion-blue)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]";
}

export function Select({ className, children, ...props }: SelectProps) {
  const composedClassName = [getSelectClassName(), className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <select className={composedClassName} {...props}>
      {children}
    </select>
  );
}
