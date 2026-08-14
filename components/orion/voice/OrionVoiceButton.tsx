"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import type { OrionVoiceCaptureMode, OrionVoiceState } from "@/lib/orion/voice";

type OrionVoiceButtonProps = {
  state: OrionVoiceState;
  mode?: OrionVoiceCaptureMode;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
};

function stateLabel(state: OrionVoiceState) {
  if (state === "requesting_permission") return "Requesting permission";
  if (state === "listening") return "Listening";
  if (state === "processing") return "Processing";
  if (state === "clarification") return "Clarification required";
  if (state === "confirmation_required") return "Confirmation required";
  if (state === "executing") return "Executing";
  if (state === "success") return "Success";
  if (state === "error") return "Error";
  if (state === "unsupported") return "Unsupported";
  return "Idle";
}

export function OrionVoiceButton({ state, mode = "push_to_talk", disabled, onStart, onStop }: OrionVoiceButtonProps) {
  const listening = state === "listening" || state === "requesting_permission";

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (mode !== "push_to_talk") {
      return;
    }

    event.preventDefault();
    if (!disabled) {
      onStart();
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (mode !== "push_to_talk") {
      return;
    }

    event.preventDefault();
    onStop();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat) {
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!disabled) {
        if (mode === "tap_to_listen") {
          if (listening) {
            onStop();
          } else {
            onStart();
          }
          return;
        }

        onStart();
      }
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (mode !== "push_to_talk") {
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onStop();
    }
  };

  return (
    <button
      type="button"
      className={[
        "inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]",
        listening
          ? "border-rose-300/80 bg-rose-500/25 text-rose-100"
          : "border-white/25 bg-white/10 text-slate-100 hover:bg-white/15",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
      aria-label={`Push to talk with Orion. Current state: ${stateLabel(state)}.`}
      aria-pressed={listening}
      disabled={disabled}
      onClick={() => {
        if (disabled || mode !== "tap_to_listen") {
          return;
        }

        if (listening) {
          onStop();
          return;
        }

        onStart();
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      {listening ? "■" : "🎤"}
    </button>
  );
}
