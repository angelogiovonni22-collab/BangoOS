"use client";

type OrionVoiceTranscriptProps = {
  interimTranscript: string;
  finalTranscript: string;
  onStop: () => void;
  onCancel: () => void;
  onRestart: () => void;
  onRetry: () => void;
};

export function OrionVoiceTranscript({
  interimTranscript,
  finalTranscript,
  onStop,
  onCancel,
  onRestart,
  onRetry,
}: OrionVoiceTranscriptProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-300">Voice transcript</p>
      <div className="rounded border border-white/15 bg-white/5 px-2.5 py-2 text-xs text-slate-100" aria-live="polite" aria-atomic="true">
        <p>Interim {interimTranscript || "..."}</p>
        <p className="mt-1">Final {finalTranscript || "..."}</p>
      </div>
      <div className="flex flex-wrap gap-1">
        <button type="button" className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/10" onClick={onStop}>
          Stop
        </button>
        <button type="button" className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/10" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/10" onClick={onRestart}>
          Restart
        </button>
        <button type="button" className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[11px] text-slate-100 hover:bg-white/10" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}
