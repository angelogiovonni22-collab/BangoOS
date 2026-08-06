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
      "bg-[linear-gradient(135deg,#2f63cc,#2d8fcf)] text-white shadow-[var(--shadow-medium)] hover:brightness-110 active:brightness-95 focus-visible:ring-[var(--focus-ring-primary)]",
    secondary:
      "border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] shadow-[var(--shadow-small)] hover:bg-[var(--bos-bg-hover)] active:brightness-95 focus-visible:ring-[var(--focus-ring-neutral)]",
    outline:
      "border border-[var(--bos-border-default)] bg-transparent text-[var(--bos-text-primary)] shadow-none hover:bg-[var(--bos-bg-hover)] active:bg-[var(--bos-bg-control)] focus-visible:ring-[var(--focus-ring-neutral)]",
    ghost:
      "text-[var(--bos-text-secondary)] hover:bg-[var(--bos-bg-hover)] hover:text-[var(--bos-text-primary)] focus-visible:ring-[var(--focus-ring-neutral)]",
    danger:
      "border border-[rgba(247,139,127,0.45)] bg-[rgba(247,139,127,0.09)] text-[var(--status-danger)] shadow-[var(--shadow-small)] hover:bg-[rgba(247,139,127,0.18)] active:bg-[rgba(247,139,127,0.22)] focus-visible:ring-[var(--focus-ring-danger)]",
    toolbar:
      "border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-panel)] text-[var(--bos-text-primary)] shadow-none hover:bg-[var(--bos-bg-hover)] focus-visible:ring-[var(--focus-ring-neutral)]",
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
