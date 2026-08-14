"use client";

type OrionMicrophoneIndicatorProps = {
  active: boolean;
};

export function OrionMicrophoneIndicator({ active }: OrionMicrophoneIndicatorProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] uppercase tracking-[0.08em]",
        active
          ? "border-rose-300/40 bg-rose-500/15 text-rose-100"
          : "border-white/20 bg-white/5 text-slate-300",
      ].join(" ")}
      aria-live="polite"
      aria-atomic="true"
    >
      <span>{active ? "●" : "○"}</span>
      <span>{active ? "Microphone On" : "Microphone Off"}</span>
    </span>
  );
}
