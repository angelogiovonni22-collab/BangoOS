"use client";

type OrionVoiceStatusProps = {
  state: string;
  message: string;
  showNotice?: boolean;
};

function displayVoiceState(state: string, message: string) {
  // The command-center interaction state starts at "listening" for historical
  // pipeline compatibility, while the Realtime voice facade correctly reports
  // "Orion v2 is ready." before microphone capture begins. Do not present that
  // pre-capture state to users as an active microphone/listening session.
  if (state === "listening" && message.trim() === "Orion v2 is ready.") {
    return "ready";
  }

  return state;
}

export function OrionVoiceStatus({ state, message, showNotice }: OrionVoiceStatusProps) {
  const visibleState = displayVoiceState(state, message);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Voice status</p>
      <p className="rounded border border-white/15 bg-white/5 px-2.5 py-2 text-xs text-slate-100" aria-live="polite" aria-atomic="true">
        State {visibleState}. {message}
      </p>
      {showNotice ? (
        <p className="rounded border border-cyan-300/30 bg-cyan-500/10 px-2.5 py-2 text-xs text-cyan-100">
          Orion processes microphone audio while an Orion voice session is active. B.O.S. does not store the raw microphone audio; voice requests are processed through your B.O.S. workspace.
        </p>
      ) : null}
    </div>
  );
}
