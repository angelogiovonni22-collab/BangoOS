import type { CSSProperties, ReactNode } from "react";

const missionControlTokens: CSSProperties = {
  "--mc-bg": "#0c1829",
  "--mc-surface": "#14283f",
  "--mc-surface-2": "#1a324f",
  "--mc-border": "#304c71",
  "--mc-text": "#e6eefb",
  "--mc-text-muted": "#9cb1cf",
  "--mc-info": "#24b8d7",
  "--mc-healthy": "#39c888",
  "--mc-attention": "#f0bc58",
  "--mc-critical": "#ef6d6d",
  "--mc-orion": "#a485ef",
  "--mc-unknown": "#9ba7bf",
  "--mc-stale": "#d0a15a",
  "--mc-unavailable": "#e59d9d",
  "--mc-shadow": "0 24px 40px -24px rgb(2 10 24 / 0.82)",
} as CSSProperties;

type MissionControlShellProps = {
  children: ReactNode;
  reducedMotion: boolean;
};

export function MissionControlShell({ children, reducedMotion }: MissionControlShellProps) {
  return (
    <section
      aria-label="Operations overview workspace"
      style={missionControlTokens}
      className={[
        "relative overflow-hidden rounded-[1.5rem] border border-[var(--mc-border)] bg-[var(--mc-bg)] px-4 py-4 text-[var(--mc-text)] shadow-[var(--mc-shadow)] sm:px-6 sm:py-6",
        "before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_14%_10%,rgba(36,184,215,0.16),transparent_34%),radial-gradient(circle_at_84%_18%,rgba(164,133,239,0.15),transparent_30%)]",
        reducedMotion ? "[--mc-motion:0ms]" : "[--mc-motion:240ms]",
      ].join(" ")}
    >
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}
