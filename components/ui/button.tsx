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
    "motion-hover-button text-button-label inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold leading-none outline-none transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-55";

  const variantClass: Record<ButtonVariant, string> = {
    primary:
      "border border-transparent bg-[linear-gradient(135deg,var(--color-action-primary),var(--color-action-primary-hover))] text-white shadow-[var(--shadow-medium)] hover:brightness-105 active:translate-y-px active:brightness-95 focus-visible:ring-[var(--focus-ring-primary)]",
    secondary:
      "border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] hover:border-[var(--bos-border-strong)] hover:bg-[var(--bos-bg-hover)] active:translate-y-px active:bg-[var(--bos-bg-panel)] focus-visible:ring-[var(--focus-ring-neutral)]",
    outline:
      "border border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-primary)] shadow-none hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)] active:translate-y-px active:bg-[var(--color-surface-muted)] focus-visible:ring-[var(--focus-ring-neutral)]",
    ghost:
      "border border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] active:translate-y-px active:bg-[var(--color-surface-muted)] focus-visible:ring-[var(--focus-ring-neutral)]",
    danger:
      "border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)] shadow-[var(--shadow-small)] hover:bg-[var(--color-danger-100)] active:translate-y-px active:bg-[var(--color-danger-200)] focus-visible:ring-[var(--focus-ring-danger)]",
    toolbar:
      "border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] shadow-none hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] active:translate-y-px active:bg-[var(--color-surface-muted)] focus-visible:ring-[var(--focus-ring-neutral)]",
  };

  const sizeClass: Record<ButtonSize, string> = {
    sm: "h-[var(--control-height-sm)] rounded-[var(--radius-md)] px-3.5",
    md: "h-[var(--control-height-md)] rounded-[var(--radius-control)] px-4",
    lg: "h-[var(--control-height-lg)] rounded-[var(--radius-control)] px-5",
    icon: "h-[var(--control-height-md)] w-[var(--control-height-md)] rounded-[var(--radius-md)] p-0",
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
