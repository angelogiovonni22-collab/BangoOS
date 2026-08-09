"use client";

import { Button, Input, Select } from "@/components/ui";
import { useGlobalOrionVoice } from "./GlobalOrionVoiceProvider";

const PREVIEW_PHRASE = "Hello. I'm Orion, your Bango Operating System assistant.";

function formatVoiceLanguage(lang: string) {
  const normalized = lang.toLowerCase().replace("_", "-");

  if (normalized.startsWith("en-au")) return "Australian English";
  if (normalized.startsWith("en-gb")) return "British English";
  if (normalized.startsWith("en-us")) return "American English";
  if (normalized.startsWith("en-ca")) return "Canadian English";
  if (normalized.startsWith("en-in")) return "Indian English";
  if (normalized.startsWith("en-ie")) return "Irish English";
  if (normalized.startsWith("en-nz")) return "New Zealand English";
  if (normalized.startsWith("en")) return "English";

  return lang;
}

export function OrionVoiceSettingsPanel() {
  const voice = useGlobalOrionVoice();
  const australianVoiceCount = voice.availableVoices.filter((option) => option.australian).length;

  const toggleSpoken = () => {
    voice.setSpokenResponsesEnabled(!voice.settings.spokenResponsesEnabled);
  };

  return (
    <section className="space-y-4" aria-label="Orion voice preferences">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-control)] px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-[var(--bos-text-primary)]">Spoken responses</p>
          <p className="text-xs text-[var(--bos-text-muted)]">Choose whether Orion should speak responses aloud.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={toggleSpoken}>
          {voice.settings.spokenResponsesEnabled ? "On" : "Off"}
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]" htmlFor="orion-voice-id">
          Voice
        </label>
        <Select
          id="orion-voice-id"
          value={voice.settings.voiceId || ""}
          onChange={(event) => voice.setVoiceId(event.currentTarget.value || null)}
          aria-label="Orion voice"
        >
          <option value="">Automatic — best natural English voice</option>
          {voice.availableVoices.map((option) => (
            <option key={option.id} value={option.id}>
              {option.recommended ? "★ Recommended — " : ""}
              {option.name} ({formatVoiceLanguage(option.lang)}{option.naturalQuality ? ", natural" : ""})
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted)]">
          <span>Natural and premium English voices are prioritized automatically.</span>
          <span>
            {australianVoiceCount > 0
              ? `${australianVoiceCount} Australian English voice${australianVoiceCount === 1 ? "" : "s"} available on this device.`
              : "No Australian English browser voice is installed on this device yet."}
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <RangeField
          id="orion-rate"
          label="Rate"
          min={0.75}
          max={1.25}
          step={0.01}
          value={voice.settings.voiceRate}
          onChange={voice.setVoiceRate}
        />
        <RangeField
          id="orion-pitch"
          label="Pitch"
          min={0.75}
          max={1.15}
          step={0.01}
          value={voice.settings.voicePitch}
          onChange={voice.setVoicePitch}
        />
        <RangeField
          id="orion-volume"
          label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={voice.settings.voiceVolume}
          onChange={voice.setVoiceVolume}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => voice.previewVoice(PREVIEW_PHRASE)}
          disabled={!voice.settings.spokenResponsesEnabled}
        >
          Preview voice
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => voice.cancelSpeech()}
          disabled={!voice.speaking}
        >
          Stop preview
        </Button>
        <span className="text-xs text-[var(--color-text-muted)]" aria-live="polite" aria-atomic="true">
          {voice.speaking ? "Preview playing..." : "Preview idle"}
        </span>
      </div>
    </section>
  );
}

type RangeFieldProps = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
};

function RangeField({ id, label, min, max, step, value, onChange }: RangeFieldProps) {
  return (
    <div className="space-y-1.5 rounded-[var(--radius-lg)] border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-control)] p-3">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">
        {label}
      </label>
      <Input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        aria-label={`${label} value ${value.toFixed(2)}`}
      />
      <p className="text-xs text-[var(--bos-text-secondary)]">{value.toFixed(2)}</p>
    </div>
  );
}
