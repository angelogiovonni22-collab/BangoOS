"use client";

type OrionWakeStatusProps = {
  active: boolean;
  supported: boolean;
  message: string;
};

export function OrionWakeStatus({ active, supported, message }: OrionWakeStatusProps) {
  const tone = !supported
    ? "border-amber-300/35 bg-amber-500/10 text-amber-100"
    : active
      ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100"
      : "border-white/15 bg-white/5 text-slate-200";

  return (
    <p className={`rounded border px-2.5 py-2 text-xs ${tone}`} aria-live="polite" aria-atomic="true">
      Wake status: {message}
    </p>
  );
}
