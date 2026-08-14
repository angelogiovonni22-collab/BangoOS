import { forwardRef, type InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

type ControlClassOptions = {
  invalid?: boolean;
};

export function getControlClassName(options: ControlClassOptions = {}) {
  return [
    "w-full h-[var(--control-height-lg)] rounded-[var(--radius-control)] border bg-[var(--color-surface-subtle)]",
    "px-4 text-control text-[var(--color-text-primary)]",
    "placeholder:font-medium placeholder:text-[var(--color-text-muted)]",
    "outline-none motion-hover-button",
    "border-[var(--color-border-strong)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]",
    "focus-visible:border-[var(--color-focus)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]",
    "disabled:cursor-not-allowed disabled:border-[var(--color-disabled-border)] disabled:bg-[var(--color-disabled-bg)] disabled:text-[var(--color-disabled-text)] disabled:placeholder:text-[var(--color-text-muted)]",
    options.invalid ? "border-[var(--color-danger-500)] focus-visible:ring-[var(--focus-ring-danger)]" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function getInputClassName() {
  return getControlClassName();
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  const composedClassName = [getControlClassName({ invalid }), className || ""]
    .filter(Boolean)
    .join(" ");

  return <input ref={ref} className={composedClassName} {...props} />;
});
