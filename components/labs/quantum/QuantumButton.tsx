import type { ButtonHTMLAttributes } from "react";

type QuantumButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export function QuantumButton({ variant = "primary", className, type = "button", ...props }: QuantumButtonProps) {
  const variantClass = variant === "primary"
    ? "bg-[var(--q-info)] text-[#082136] hover:bg-[color:color-mix(in_oklab,var(--q-info)_82%,white)]"
    : "bg-transparent text-[var(--q-text)] border border-[var(--q-border)] hover:bg-[color:color-mix(in_oklab,var(--q-surface-2)_68%,white)]";

  return (
    <button
      type={type}
      className={[
        "rounded-xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--q-info)]",
        variantClass,
        className || "",
      ].join(" ")}
      {...props}
    />
  );
}
