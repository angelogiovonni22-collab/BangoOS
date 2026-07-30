import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "section" | "div";
  variant?: "default" | "elevated" | "kpi";
};

type CardHeaderProps = HTMLAttributes<HTMLDivElement>;
type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;
type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;
type CardContentProps = HTMLAttributes<HTMLDivElement>;
type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export function Card({ as = "article", variant = "default", className, ...props }: CardProps) {
  const Component = as;

  const variantClass: Record<NonNullable<CardProps["variant"]>, string> = {
    default:
      "rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow-[0_10px_22px_-14px_rgb(15_23_42/0.16)]",
    elevated:
      "rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow-[0_16px_30px_-20px_rgb(15_23_42/0.2)]",
    kpi:
      "rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow-[0_12px_24px_-16px_rgb(15_23_42/0.18)] motion-hover-card",
  };

  const composedClassName = [
    variantClass[variant],
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <Component className={composedClassName} {...props} />;
}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  const composedClassName = [
    "border-b border-[var(--color-border-subtle)] px-5 py-4",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={composedClassName} {...props} />;
}

export function CardTitle({ className, ...props }: CardTitleProps) {
  const composedClassName = [
    "text-card-title text-[var(--color-text-primary)]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <h2 className={composedClassName} {...props} />;
}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  const composedClassName = [
    "mt-1 text-body-secondary text-[var(--color-text-secondary)]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <p className={composedClassName} {...props} />;
}

export function CardContent({ className, ...props }: CardContentProps) {
  const composedClassName = ["p-[var(--space-card-padding)]", className || ""].filter(Boolean).join(" ");

  return <div className={composedClassName} {...props} />;
}

export function CardFooter({ className, ...props }: CardFooterProps) {
  const composedClassName = [
    "border-t border-[var(--color-border-subtle)] px-5 py-4",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={composedClassName} {...props} />;
}

export function CardIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-primary-50)] text-[var(--color-brand-700)]">
      {children}
    </div>
  );
}
