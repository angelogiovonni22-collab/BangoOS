import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonClassOptions;

export function getButtonClassName(options: ButtonClassOptions = {}) {
  const variant = options.variant || "primary";
  const size = options.size || "md";

  const base =
    "motion-hover-button inline-flex items-center justify-center gap-2 font-semibold outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60";

  const variantClass: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--color-brand-600)] text-white shadow-[var(--shadow-sm)] hover:bg-[var(--color-brand-700)] active:bg-[var(--color-brand-800)] focus-visible:ring-[var(--focus-ring-primary)]",
    secondary:
      "bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-neutral-100)] focus-visible:ring-[var(--focus-ring-neutral)]",
    outline:
      "border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-surface-subtle)] active:bg-[var(--color-surface-muted)] focus-visible:ring-[var(--focus-ring-neutral)]",
    ghost:
      "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] focus-visible:ring-[var(--focus-ring-neutral)]",
    danger:
      "border border-[var(--color-danger-200)] bg-white text-[var(--color-danger-700)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-danger-50)] active:bg-[var(--color-danger-100)] focus-visible:ring-[var(--focus-ring-danger)]",
  };

  const sizeClass: Record<ButtonSize, string> = {
    sm: "rounded-[var(--radius-md)] px-3 py-1.5 text-xs",
    md: "rounded-[var(--radius-lg)] px-4 py-2.5 text-sm",
    lg: "rounded-[var(--radius-lg)] px-5 py-3 text-sm",
  };

  return [
    base,
    variantClass[variant],
    sizeClass[size],
    options.fullWidth ? "w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  const composedClassName = [
    getButtonClassName({ variant, size, fullWidth }),
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <button type={type} className={composedClassName} {...props} />;
}
