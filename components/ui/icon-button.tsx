import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { getButtonClassName } from "./button";

type IconControlProps = {
  icon: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
};

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & IconControlProps;

type IconLinkProps = IconControlProps & {
  href: string;
};

function getIconControlClassName(variant: IconControlProps["variant"] = "secondary", size: IconControlProps["size"] = "md", className = "") {
  const sizeOverride =
    size === "sm"
      ? "h-10 w-10 p-0"
      : size === "lg"
        ? "h-12 w-12 p-0"
        : "h-11 w-11 p-0";

  return [
    getButtonClassName({ variant, size: "icon" }),
    sizeOverride,
    "shrink-0",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function IconButton({
  icon,
  label,
  className,
  variant = "secondary",
  size = "md",
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button type={type} aria-label={label} className={getIconControlClassName(variant, size, className)} {...props}>
      {icon}
    </button>
  );
}

export function IconLink({
  href,
  icon,
  label,
  className,
  variant = "secondary",
  size = "md",
}: IconLinkProps) {
  return (
    <Link href={href} aria-label={label} className={getIconControlClassName(variant, size, className)}>
      {icon}
    </Link>
  );
}
