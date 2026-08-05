"use client";

type OrionVoiceStatusProps = {
  state: string;
  message: string;
  showNotice?: boolean;
};

export function OrionVoiceStatus({ state, message, showNotice }: OrionVoiceStatusProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Voice status</p>
      <p className="rounded border border-white/15 bg-white/5 px-2.5 py-2 text-xs text-slate-100" aria-live="polite" aria-atomic="true">
        State {state}. {message}
      </p>
      {showNotice ? (
        <p className="rounded border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-2 text-xs text-cyan-100">
          Orion uses your device microphone only while you are actively speaking. Voice requests are converted to text and processed through your B.O.S. workspace.
        </p>
      ) : null}
    </div>
  );
}
