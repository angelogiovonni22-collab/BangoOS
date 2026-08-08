import type { SelectHTMLAttributes } from "react";
import { getControlClassName } from "./input";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function getSelectClassName() {
  return [
    getControlClassName(),
    "appearance-none bg-[linear-gradient(45deg,transparent_50%,var(--color-text-muted)_50%),linear-gradient(135deg,var(--color-text-muted)_50%,transparent_50%)] bg-[position:calc(100%-18px)_calc(50%-2px),calc(100%-12px)_calc(50%-2px)] bg-[size:6px_6px,6px_6px] bg-no-repeat pr-10",
  ].join(" ");
}

export function Select({ className, children, ...props }: SelectProps) {
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  const composedClassName = [getSelectClassName(), invalid ? getControlClassName({ invalid: true }) : "", className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <select className={composedClassName} {...props}>
      {children}
    </select>
  );
}
