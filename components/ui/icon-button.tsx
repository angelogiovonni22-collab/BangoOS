import type { ButtonHTMLAttributes, ReactNode } from "react";
import { getButtonClassName } from "./button";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function IconButton({
  icon,
  label,
  className,
  variant = "secondary",
  size = "md",
  type = "button",
  ...props
}: IconButtonProps) {
  const sizeOverride =
    size === "sm"
      ? "h-8 w-8 p-0"
      : size === "lg"
        ? "h-12 w-12 p-0"
        : "h-10 w-10 p-0";

  const composedClassName = [
    getButtonClassName({ variant, size }),
    sizeOverride,
    "shrink-0",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} aria-label={label} className={composedClassName} {...props}>
      {icon}
    </button>
  );
}
