"use client";

import Link from "next/link";
import { useRef, type CSSProperties, type RefObject } from "react";
import {
  AudioLines,
  Binoculars,
  BrainCircuit,
  Check,
  CircleUserRound,
  Mic,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import { useFocusTrap } from "@/components/motion";
import { OrionVoiceButton, OrionVoiceStatus, OrionVoiceTranscript, type OrionRealtimeVoice, type OrionUnifiedVoiceController } from "@/components/orion/voice";
import type { PersistentOrionFixture } from "./types";

type PersistentOrionPanelProps = {
  panelId: string;
  open: boolean;
  fixture: PersistentOrionFixture;
  minimized: boolean;
  voice: OrionUnifiedVoiceController;
  onClose: () => void;
  onToggleMinimized: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle?: CSSProperties;
};

function voiceLabel(voice: OrionRealtimeVoice) {
  const label = voice.charAt(0).toUpperCase() + voice.slice(1);
  return voice === "marin" ? `${label} — Recommended` : label;
}

export function PersistentOrionPanel({
  panelId,
  open,
  fixture,
  minimized,
  voice,
  onClose,
  onToggleMinimized,
  panelRef,
  panelStyle,
}: PersistentOrionPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
  });

  if (!open) {
    return null;
  }

  const realtimeSessionActive = voice.realtimeState !== "closed" && voice.realtimeState !== "idle" && voice.realtimeState !== "error";
  const stateLabel = fixture.state.replace(/_/g, " ");

  return (
    <section
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Persistent Orion panel. State ${fixture.state}.`}
      className="persistentOrionPanel"
      style={panelStyle}
      tabIndex={-1}
    >
      <span className="persistentOrionSr">Prototype Intelligence</span>
      <span className="persistentOrionSr">Fixture Data</span>

      <header className="persistentOrionPanelHeader">
        <div className="persistentOrionTitleBlock">
          <div className="persistentOrionIdentity">
            <div className="persistentOrionIdentityMark" aria-hidden="true">
              <BrainCircuit size={24} />
            </div>
            <div>
              <p className="persistentOrionPanelTitle">ORION V2</p>
              <h3>{fixture.workspace}</h3>
            </div>
          </div>
          <p className="persistentOrionStateLine">
            <span className="persistentOrionStateDot" aria-hidden="true" />
            <span>State:</span>
            <strong>{stateLabel}</strong>
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="persistentOrionClose"
          onClick={onClose}
          aria-label="Close Orion panel"
        >
          <X size={24} aria-hidden="true" />
          <span>Close</span>
        </button>
      </header>

      <div className="persistentOrionFixtureTags" aria-label="Orion architecture">
        <span><BrainCircuit size={15} aria-hidden="true" />Realtime LLM Intelligence</span>
        <span><ShieldCheck size={15} aria-hidden="true" />Controlled BOS Tools</span>
      </div>

      <section className="persistentOrionSection persistentOrionSectionBordered">
        <div className="persistentOrionSectionHeading">
          <Binoculars size={21} aria-hidden="true" />
          <p className="persistentOrionEyebrow">Observation</p>
        </div>
        <p className="persistentOrionSectionCopy">{fixture.observation}</p>
      </section>

      <section className="persistentOrionSection persistentOrionSectionBordered">
        <div className="persistentOrionSectionHeading">
          <Target size={21} aria-hidden="true" />
          <p className="persistentOrionEyebrow">Why it matters</p>
        </div>
        <p className="persistentOrionSectionCopy">{fixture.whyItMatters}</p>
      </section>

      <section className="persistentOrionSection persistentOrionSectionBordered" aria-label="Orion voice controls">
        <div className="persistentOrionSectionHeading">
          <Mic size={21} aria-hidden="true" />
          <p className="persistentOrionEyebrow">Voice</p>
        </div>
        <div className="persistentOrionVoiceActions">
          <OrionVoiceButton
            state={voice.micActive ? "listening" : "idle"}
            mode="tap_to_listen"
            onStart={() => void voice.start()}
            onStop={() => void voice.stop()}
          />
          <button
            type="button"
            className="persistentOrionVoicePrimary"
            onClick={() => voice.setSpokenResponsesEnabled(!voice.settings.spokenResponsesEnabled)}
          >
            {voice.settings.spokenResponsesEnabled ? "Mute Voice" : "Unmute Voice"}
          </button>
          <button
            type="button"
            className="persistentOrionVoiceSecondary"
            onClick={() => {
              if (voice.settings.enabled) {
                void voice.disableVoice();
              } else {
                voice.enableVoice();
              }
            }}
          >
            {voice.settings.enabled ? "Disable Voice" : "Enable Voice"}
          </button>
        </div>
      </section>

      <section className="persistentOrionSection persistentOrionRealtimeSection" aria-label="Realtime voice settings">
        <div className="persistentOrionSectionHeading">
          <AudioLines size={21} aria-hidden="true" />
          <p className="persistentOrionEyebrow">Realtime Voice</p>
        </div>

        <label className="persistentOrionVoiceSelectWrap" htmlFor="orion-realtime-voice-select">
          <CircleUserRound size={24} aria-hidden="true" />
          <span className="persistentOrionVoiceSelectText">
            <strong>{voiceLabel(voice.realtimeVoice)}</strong>
            <span>OpenAI Realtime voice</span>
          </span>
          <select
            id="orion-realtime-voice-select"
            className="persistentOrionVoiceSelect"
            value={voice.realtimeVoice}
            disabled={realtimeSessionActive}
            onChange={(event) => voice.setRealtimeVoice(event.target.value as OrionRealtimeVoice)}
            aria-label="Realtime voice"
          >
            {voice.availableRealtimeVoices.map((option) => (
              <option key={option} value={option}>{voiceLabel(option)}</option>
            ))}
          </select>
        </label>

        <p className="persistentOrionVoiceNote">
          {realtimeSessionActive ? "End the current Realtime conversation to change voices." : "Your Realtime voice choice is saved on this device."}
        </p>
        <p className="persistentOrionVoiceNote persistentOrionIsolationNote" role="status">
          Focused voice isolation is active: background noise is reduced.
          <Check size={17} aria-hidden="true" />
        </p>

        <div className="persistentOrionEngineLabel">Engine: ORION V2 · OPENAI REALTIME</div>
        <div className="persistentOrionVoiceStatusWrap">
          <OrionVoiceStatus
            state={voice.phase}
            message={voice.statusMessage || voice.supportMessage}
            showNotice
          />
        </div>
        <div className="persistentOrionVoiceTranscriptWrap">
          <OrionVoiceTranscript
            interimTranscript={voice.interimTranscript}
            finalTranscript={voice.finalTranscript}
            onStop={() => void voice.stop()}
            onCancel={() => void voice.stop()}
            onRestart={() => void voice.start()}
            onRetry={() => void voice.retry()}
          />
        </div>
      </section>

      <dl className="persistentOrionFacts">
        <div>
          <dt>Evidence status</dt>
          <dd>{fixture.evidenceStatus}</dd>
        </div>
        <div>
          <dt>Data freshness</dt>
          <dd>{fixture.dataFreshness}</dd>
        </div>
        <div>
          <dt>Recommended next review</dt>
          <dd>{fixture.recommendedNextReview}</dd>
        </div>
        <div>
          <dt>Approval boundary</dt>
          <dd>{fixture.approvalBoundary}</dd>
        </div>
        <div>
          <dt>Limitations</dt>
          <dd>{fixture.limitations}</dd>
        </div>
      </dl>

      <footer className="persistentOrionPanelFooter">
        <Link href="/labs/orion-core" className="persistentOrionLinkAction" onClick={onClose}>
          Open Orion Core Lab
        </Link>
        <button type="button" className="persistentOrionMinimize" onClick={onToggleMinimized}>
          {minimized ? "Restore Orion" : "Minimize Orion"}
        </button>
      </footer>
    </section>
  );
}
