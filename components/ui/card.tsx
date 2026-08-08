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
      "rounded-[var(--radius-card)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] shadow-[var(--shadow-small)]",
    elevated:
      "rounded-[var(--radius-card)] border border-[var(--bos-border-strong)] bg-[var(--bos-bg-panel-elevated)] shadow-[var(--shadow-medium)]",
    kpi:
      "rounded-[var(--radius-xl)] border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-control)] shadow-[var(--shadow-small)]",
  };

  const composedClassName = [
    "outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-neutral)]",
    variantClass[variant],
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <Component className={composedClassName} {...props} />;
}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  const composedClassName = [
    "border-b border-[var(--bos-border-subtle)] px-5 py-[1.125rem]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={composedClassName} {...props} />;
}

export function CardTitle({ className, ...props }: CardTitleProps) {
  const composedClassName = [
    "text-card-title text-[var(--bos-text-primary)]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <h2 className={composedClassName} {...props} />;
}

export function CardDescription({ className, ...props }: CardDescriptionProps) {
  const composedClassName = [
    "mt-1.5 text-body-secondary font-medium text-[var(--bos-text-secondary)]",
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
    "border-t border-[var(--bos-border-subtle)] px-5 py-[1.125rem]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={composedClassName} {...props} />;
}

export function CardIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--orion-cyan)]">
      {children}
    </div>
  );
}
