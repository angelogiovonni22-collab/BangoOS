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
      "rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-card)]",
    elevated:
      "rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-large)]",
    kpi:
      "rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-medium)] motion-hover-card",
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
    "border-b border-[var(--color-border-subtle)] px-6 py-5",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={composedClassName} {...props} />;
}

export function CardTitle({ className, ...props }: CardTitleProps) {
  const composedClassName = [
    "text-lg font-semibold text-[var(--color-text-primary)]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <h2 className={composedClassName} {...props} />;
}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  const composedClassName = [
    "mt-1 text-sm text-[var(--color-text-muted)]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <p className={composedClassName} {...props} />;
}

export function CardContent({ className, ...props }: CardContentProps) {
  const composedClassName = ["p-6", className || ""].filter(Boolean).join(" ");

  return <div className={composedClassName} {...props} />;
}

export function CardFooter({ className, ...props }: CardFooterProps) {
  const composedClassName = [
    "border-t border-[var(--color-border-subtle)] px-6 py-4",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={composedClassName} {...props} />;
}

export function CardIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
      {children}
    </div>
  );
}
