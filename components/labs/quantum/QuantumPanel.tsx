import type { ReactNode } from "react";

type QuantumPanelProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  variant?: "open" | "grouped" | "elevated" | "focused" | "critical" | "orion";
};

const panelVariants: Record<NonNullable<QuantumPanelProps["variant"]>, string> = {
  open: "bg-transparent border-transparent p-0",
  grouped: "border border-[color:color-mix(in_oklab,var(--q-border)_70%,transparent)] bg-[color:color-mix(in_oklab,var(--q-surface)_70%,black)]",
  elevated: "border border-transparent bg-[color:color-mix(in_oklab,var(--q-surface)_82%,black)] shadow-[0_20px_36px_-24px_rgba(2,8,20,0.84)]",
  focused: "border border-[color:color-mix(in_oklab,var(--q-info)_55%,var(--q-border))] bg-[color:color-mix(in_oklab,var(--q-surface)_82%,black)]",
  critical: "border border-[color:color-mix(in_oklab,var(--q-critical)_60%,var(--q-border))] bg-[color:color-mix(in_oklab,var(--q-surface)_80%,black)]",
  orion: "border border-[color:color-mix(in_oklab,var(--q-orion)_58%,var(--q-border))] bg-[linear-gradient(165deg,rgba(29,40,71,0.94),rgba(18,34,58,0.96))]",
};

export function QuantumPanel({ title, subtitle, children, action, variant = "grouped" }: QuantumPanelProps) {
  return (
    <section className={[
      "rounded-2xl p-4 sm:p-5",
      panelVariants[variant],
    ].join(" ")}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--q-text)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[var(--q-text-muted)]">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
