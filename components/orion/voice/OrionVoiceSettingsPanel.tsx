"use client";

import { Button, Select } from "@/components/ui";
import { useOrionUnifiedVoice, type OrionRealtimeVoice } from "./useOrionUnifiedVoice";

export function OrionVoiceSettingsPanel() {
  const voice = useOrionUnifiedVoice();

  const toggleVoice = () => {
    voice.setSpokenResponsesEnabled(!voice.settings.spokenResponsesEnabled);
  };

  return (
    <section className="space-y-4" aria-label="Orion voice preferences">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-control)] px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-[var(--bos-text-primary)]">Orion voice</p>
          <p className="text-xs text-[var(--bos-text-muted)]">Turning voice off disconnects Orion from the microphone and stops spoken responses.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={toggleVoice}>
          {voice.settings.spokenResponsesEnabled ? "On" : "Off"}
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]" htmlFor="orion-voice-id">
          Realtime voice
        </label>
        <Select
          id="orion-voice-id"
          value={voice.realtimeVoice}
          onChange={(event) => voice.setRealtimeVoice(event.currentTarget.value as OrionRealtimeVoice)}
          aria-label="Orion Realtime voice"
        >
          {voice.availableRealtimeVoices.map((option) => (
            <option key={option} value={option}>
              {option === "marin" ? "★ Recommended — Marin" : option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </Select>
        <p className="text-xs text-[var(--color-text-muted)]">
          Voice changes apply when the next Realtime conversation starts. Marin is recommended for natural speech.
        </p>
      </div>
    </section>
  );
}
