import type { CSSProperties, ReactNode } from "react";

type QuantumShellProps = {
  children: ReactNode;
  reducedMotion: boolean;
};

const quantumTokens: CSSProperties = {
  "--q-bg": "#0b1627",
  "--q-bg-soft": "#101f35",
  "--q-surface": "#13243f",
  "--q-surface-2": "#192f4f",
  "--q-border": "#294365",
  "--q-text": "#e2ebfb",
  "--q-text-muted": "#93a8c8",
  "--q-info": "#18b7d9",
  "--q-healthy": "#33c27f",
  "--q-attention": "#f6b64f",
  "--q-critical": "#f36464",
  "--q-orion": "#9f7aea",
  "--q-shadow": "0 20px 36px -24px rgb(1 8 22 / 0.8)",
} as CSSProperties;

export function QuantumShell({ children, reducedMotion }: QuantumShellProps) {
  return (
    <section
      aria-label="Quantum Lab workspace"
      style={quantumTokens}
      className={[
        "relative overflow-hidden rounded-[1.5rem] border border-[var(--q-border)] bg-[var(--q-bg)] p-4 text-[var(--q-text)] shadow-[var(--q-shadow)] sm:p-6",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_12%_8%,rgba(24,183,217,0.18),transparent_33%),radial-gradient(circle_at_84%_20%,rgba(159,122,234,0.16),transparent_28%)]",
        reducedMotion ? "[--q-motion:0ms]" : "[--q-motion:220ms]",
      ].join(" ")}
    >
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}
