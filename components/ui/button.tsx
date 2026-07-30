import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "toolbar";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonClassOptions;

export function getButtonClassName(options: ButtonClassOptions = {}) {
  const variant = options.variant || "primary";
  const size = options.size || "md";

  const base =
    "motion-hover-button inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-4";

  const variantClass: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--color-brand-700)] text-white shadow-[var(--shadow-medium)] hover:bg-[var(--color-brand-800)] active:bg-[var(--color-brand-800)] focus-visible:ring-[var(--focus-ring-primary)]",
    secondary:
      "border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-primary)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-surface-subtle)] active:bg-[var(--color-neutral-100)] focus-visible:ring-[var(--focus-ring-neutral)]",
    outline:
      "border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-primary)] shadow-none hover:bg-[var(--color-surface-subtle)] active:bg-[var(--color-surface-muted)] focus-visible:ring-[var(--focus-ring-neutral)]",
    ghost:
      "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] focus-visible:ring-[var(--focus-ring-neutral)]",
    danger:
      "border border-[var(--color-danger-200)] bg-white text-[var(--color-danger-700)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-danger-50)] active:bg-[var(--color-danger-100)] focus-visible:ring-[var(--focus-ring-danger)]",
    toolbar:
      "border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-none hover:bg-[var(--color-surface-subtle)] focus-visible:ring-[var(--focus-ring-neutral)]",
  };

  const sizeClass: Record<ButtonSize, string> = {
    sm: "rounded-[var(--radius-md)] px-3 py-1.5 text-xs",
    md: "rounded-[var(--radius-lg)] px-4 py-2.5 text-sm",
    lg: "rounded-[var(--radius-lg)] px-5 py-3 text-sm",
    icon: "h-9 w-9 rounded-[var(--radius-md)] p-0",
  };

  return [
    base,
    variantClass[variant],
    sizeClass[size],
    options.isLoading ? "cursor-wait" : "",
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
  isLoading = false,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  const composedClassName = [
    getButtonClassName({ variant, size, fullWidth, isLoading }),
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={composedClassName} disabled={disabled || isLoading} aria-busy={isLoading} {...props}>
      {children}
    </button>
  );
}
