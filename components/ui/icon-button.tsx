import type { ButtonHTMLAttributes, ReactNode } from "react";
import { getButtonClassName } from "./button";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
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
      ? "h-10 w-10 p-0"
      : size === "lg"
        ? "h-12 w-12 p-0"
        : "h-11 w-11 p-0";

  const composedClassName = [
    getButtonClassName({ variant, size: "icon" }),
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
