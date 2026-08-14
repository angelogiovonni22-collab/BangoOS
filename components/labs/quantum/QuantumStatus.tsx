import type { QuantumSeverity } from "@/lib/labs/quantum/types";

type QuantumStatusProps = {
  tone: QuantumSeverity;
  label: string;
};

const toneClass: Record<QuantumSeverity, string> = {
  healthy: "bg-[color:color-mix(in_oklab,var(--q-healthy)_20%,transparent)] text-[var(--q-healthy)] border-[color:color-mix(in_oklab,var(--q-healthy)_45%,transparent)]",
  info: "bg-[color:color-mix(in_oklab,var(--q-info)_20%,transparent)] text-[var(--q-info)] border-[color:color-mix(in_oklab,var(--q-info)_45%,transparent)]",
  attention: "bg-[color:color-mix(in_oklab,var(--q-attention)_20%,transparent)] text-[var(--q-attention)] border-[color:color-mix(in_oklab,var(--q-attention)_45%,transparent)]",
  critical: "bg-[color:color-mix(in_oklab,var(--q-critical)_20%,transparent)] text-[var(--q-critical)] border-[color:color-mix(in_oklab,var(--q-critical)_45%,transparent)]",
  orion: "bg-[color:color-mix(in_oklab,var(--q-orion)_24%,transparent)] text-[var(--q-orion)] border-[color:color-mix(in_oklab,var(--q-orion)_45%,transparent)]",
};

export function QuantumStatus({ tone, label }: QuantumStatusProps) {
  return (
    <span className={[
      "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.09em]",
      toneClass[tone],
    ].join(" ")}
    >
      {label}
    </span>
  );
}
