import type { HTMLAttributes } from "react";

type SkeletonLoaderProps = HTMLAttributes<HTMLDivElement>;

export function SkeletonLoader({ className, ...props }: SkeletonLoaderProps) {
  const composedClassName = [
    "animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)]",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={composedClassName} {...props} />;
}
