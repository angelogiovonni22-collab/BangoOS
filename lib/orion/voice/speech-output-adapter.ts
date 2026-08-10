export type OrionSpeechVoiceOption = {
  id: string;
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  english: boolean;
  australian: boolean;
  naturalQuality: boolean;
  recommended: boolean;
};

export type OrionSpeechSpeakOptions = {
  voiceId?: string | null;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export type OrionSpeechAdapter = {
  speak: (text: string, options?: OrionSpeechSpeakOptions) => boolean;
  preview: (text: string, options?: OrionSpeechSpeakOptions) => boolean;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  isSpeaking: () => boolean;
  getAvailableVoices: () => OrionSpeechVoiceOption[];
  subscribeToVoices: (listener: (voices: OrionSpeechVoiceOption[]) => void) => () => void;
  subscribeToVoiceLevel: (listener: (level: number) => void) => () => void;
  subscribeToSpeaking: (listener: (speaking: boolean) => void) => () => void;
};

export const ORION_SPEECH_ENDED_EVENT = "orion:speech-ended";

const NATURAL_VOICE_PATTERN = /(neural|natural|premium|enhanced|online)/i;
const FEMININE_VOICE_PATTERN = /(samantha|karen|matilda|aria|jenny|sonia|ava|susan|zira|tessa|moira|serena|victoria|fiona|olivia|joanna|emma|amy|nicole|natasha|salli|ivy|kimberly|ruth|maisie|libby|leah)/i;
const DUPLICATE_SPEECH_WINDOW_MS = 2_500;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toVoiceId(voice: SpeechSynthesisVoice) {
  return voice.voiceURI || `${voice.name}|${voice.lang}`;
}

function isEnglishVoice(voice: SpeechSynthesisVoice) {
  return voice.lang.toLowerCase().startsWith("en");
}

function isAustralianVoice(voice: SpeechSynthesisVoice) {
  return voice.lang.toLowerCase().replace("_", "-").startsWith("en-au");
}

function hasNaturalQuality(voice: SpeechSynthesisVoice) {
  return NATURAL_VOICE_PATTERN.test(`${voice.name} ${voice.voiceURI}`);
}

function looksLikeFeminineVoice(voice: SpeechSynthesisVoice) {
  return FEMININE_VOICE_PATTERN.test(`${voice.name} ${voice.voiceURI}`);
}

function scoreVoice(voice: SpeechSynthesisVoice) {
  let score = 0;

  if (isEnglishVoice(voice)) score += 200;
  if (isAustralianVoice(voice)) score += 90;
  if (hasNaturalQuality(voice)) score += 120;
  if (looksLikeFeminineVoice(voice)) score += 55;
  if (voice.localService) score += 35;
  if (voice.default) score += 20;

  return score;
}

function normalizeVoices(voices: SpeechSynthesisVoice[]) {
  const sorted = [...voices].sort((left, right) => {
    const diff = scoreVoice(right) - scoreVoice(left);
    if (diff !== 0) return diff;
    return left.name.localeCompare(right.name);
  });

  const firstEnglish = sorted.find((voice) => isEnglishVoice(voice));
  const recommendedVoiceId = firstEnglish
    ? toVoiceId(firstEnglish)
    : sorted[0]
      ? toVoiceId(sorted[0])
      : null;

  return sorted.map((voice) => ({
    id: toVoiceId(voice),
    voiceURI: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
    localService: Boolean(voice.localService),
    default: Boolean(voice.default),
    english: isEnglishVoice(voice),
    australian: isAustralianVoice(voice),
    naturalQuality: hasNaturalQuality(voice),
    recommended: recommendedVoiceId === toVoiceId(voice),
  }));
}

function resolveVoiceById(voiceId: string | null | undefined, voices: SpeechSynthesisVoice[]) {
  if (!voiceId) return null;

  const byVoiceUri = voices.find((voice) => voice.voiceURI === voiceId);
  if (byVoiceUri) return byVoiceUri;

  const byComposite = voices.find((voice) => `${voice.name}|${voice.lang}` === voiceId);
  if (byComposite) return byComposite;

  return null;
}

function pickPreferredVoice(savedVoiceId: string | null | undefined, voices: SpeechSynthesisVoice[]) {
  if (voices.length === 0) return null;

  const saved = resolveVoiceById(savedVoiceId, voices);
  if (saved) return saved;

  const ranked = [...voices].sort((left, right) => scoreVoice(right) - scoreVoice(left));
  const english = ranked.filter((voice) => isEnglishVoice(voice));
  return english[0] || ranked[0] || null;
}

class BrowserSpeechOutputAdapter implements OrionSpeechAdapter {
  private voiceLevelListeners = new Set<(level: number) => void>();
  private voicesListeners = new Set<(voices: OrionSpeechVoiceOption[]) => void>();
  private speakingListeners = new Set<(speaking: boolean) => void>();
  private voicesChangedBound = false;
  private boundaryPulseTimer: number | null = null;
  private cadencePulseTimer: number | null = null;
  private speaking = false;
  private currentLevel = 0;
  private currentBoundaryStep = 0;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private activeUtteranceText: string | null = null;
  private lastAcceptedText: string | null = null;
  private lastAcceptedAt = 0;

  isSpeaking() {
    return this.speaking;
  }

  getAvailableVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
    return normalizeVoices(window.speechSynthesis.getVoices());
  }

  subscribeToVoices(listener: (voices: OrionSpeechVoiceOption[]) => void) {
    this.voicesListeners.add(listener);
    this.bindVoicesChanged();
    listener(this.getAvailableVoices());
    return () => {
      this.voicesListeners.delete(listener);
    };
  }

  subscribeToVoiceLevel(listener: (level: number) => void) {
    this.voiceLevelListeners.add(listener);
    listener(this.currentLevel);
    return () => {
      this.voiceLevelListeners.delete(listener);
    };
  }

  subscribeToSpeaking(listener: (speaking: boolean) => void) {
    this.speakingListeners.add(listener);
    listener(this.speaking);
    return () => {
      this.speakingListeners.delete(listener);
    };
  }

  speak(text: string, options?: OrionSpeechSpeakOptions) {
    return this.startUtterance(text, options, false);
  }

  preview(text: string, options?: OrionSpeechSpeakOptions) {
    return this.startUtterance(text, options, true);
  }

  cancel() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    this.cleanupCadenceTimers();
    this.activeUtterance = null;
    this.activeUtteranceText = null;
    this.setVoiceLevel(0);
    this.setSpeaking(false);
    window.speechSynthesis.cancel();
  }

  pause() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    this.setVoiceLevel(0.08);
  }

  resume() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
  }

  private bindVoicesChanged() {
    if (this.voicesChangedBound || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const handle = () => {
      const voices = this.getAvailableVoices();
      for (const listener of this.voicesListeners) listener(voices);
    };

    window.speechSynthesis.addEventListener("voiceschanged", handle);
    this.voicesChangedBound = true;
  }

  private startUtterance(text: string, options?: OrionSpeechSpeakOptions, allowDuplicate = false) {
    const trimmed = text.trim();
    if (!trimmed || typeof window === "undefined" || !("speechSynthesis" in window)) return false;

    const now = Date.now();
    if (!allowDuplicate) {
      const identicalActiveUtterance = this.activeUtterance !== null && this.activeUtteranceText === trimmed;
      const identicalRecentUtterance = this.lastAcceptedText === trimmed && now - this.lastAcceptedAt < DUPLICATE_SPEECH_WINDOW_MS;
      if (identicalActiveUtterance || identicalRecentUtterance) return false;
    }

    this.lastAcceptedText = trimmed;
    this.lastAcceptedAt = now;

    const synth = window.speechSynthesis;
    const availableVoices = synth.getVoices();
    const utterance = new SpeechSynthesisUtterance(trimmed);
    const resolvedVoice = pickPreferredVoice(options?.voiceId, availableVoices);

    if (resolvedVoice) {
      utterance.voice = resolvedVoice;
      utterance.lang = resolvedVoice.lang;
    } else {
      utterance.lang = "en-US";
    }

    utterance.rate = clamp(options?.rate ?? 0.95, 0.75, 1.25);
    utterance.pitch = clamp(options?.pitch ?? 0.9, 0.75, 1.15);
    utterance.volume = clamp(options?.volume ?? 1, 0, 1);

    utterance.onstart = () => {
      this.activeUtterance = utterance;
      this.activeUtteranceText = trimmed;
      this.currentBoundaryStep = 0;
      this.setSpeaking(true);
      this.startCadencePulse(trimmed, utterance.rate);
      this.setVoiceLevel(0.2);
    };

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      this.currentBoundaryStep += 1;
      const punctuationBoost = /[.,!?;:]/.test(trimmed.charAt(Math.max(0, event.charIndex - 1))) ? 0.22 : 0;
      const level = clamp(0.3 + ((this.currentBoundaryStep % 4) * 0.12) + punctuationBoost, 0, 1);
      this.setVoiceLevel(level);
      this.scheduleBoundaryLevelDrop();
    };

    utterance.onpause = () => this.setVoiceLevel(0.08);
    utterance.onresume = () => this.setVoiceLevel(0.2);
    utterance.onend = () => this.finishUtterance(utterance);
    utterance.onerror = () => this.finishUtterance(utterance);

    synth.cancel();
    synth.speak(utterance);
    return true;
  }

  private startCadencePulse(text: string, rate: number) {
    this.cleanupCadenceTimers();

    const baseCadence = clamp(220 / clamp(rate, 0.75, 1.25), 130, 280);
    const punctuationCount = (text.match(/[.,!?;:]/g) || []).length;
    const punctuationCycle = Math.max(1, punctuationCount + 2);
    let step = 0;

    this.cadencePulseTimer = window.setInterval(() => {
      if (!this.speaking) return;

      step += 1;
      const punctuationAccent = step % punctuationCycle === 0 ? 0.18 : 0;
      const envelope = 0.22 + Math.abs(Math.sin(step * 0.72)) * 0.22 + punctuationAccent;
      this.setVoiceLevel(clamp(envelope, 0.12, 0.88));
    }, baseCadence);
  }

  private scheduleBoundaryLevelDrop() {
    if (this.boundaryPulseTimer !== null) window.clearTimeout(this.boundaryPulseTimer);

    this.boundaryPulseTimer = window.setTimeout(() => {
      if (!this.speaking) return;

      this.setVoiceLevel(clamp(this.currentLevel * 0.7, 0.12, 0.62));
      this.boundaryPulseTimer = null;
    }, 120);
  }

  private finishUtterance(utterance: SpeechSynthesisUtterance) {
    if (this.activeUtterance !== utterance) return;

    this.activeUtterance = null;
    this.activeUtteranceText = null;
    this.cleanupCadenceTimers();
    this.setVoiceLevel(0);
    this.setSpeaking(false);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(ORION_SPEECH_ENDED_EVENT));
    }
  }

  private cleanupCadenceTimers() {
    if (this.cadencePulseTimer !== null) {
      window.clearInterval(this.cadencePulseTimer);
      this.cadencePulseTimer = null;
    }

    if (this.boundaryPulseTimer !== null) {
      window.clearTimeout(this.boundaryPulseTimer);
      this.boundaryPulseTimer = null;
    }
  }

  private setVoiceLevel(next: number) {
    const clamped = clamp(next, 0, 1);
    if (Math.abs(clamped - this.currentLevel) < 0.03) return;

    this.currentLevel = clamped;
    for (const listener of this.voiceLevelListeners) listener(clamped);
  }

  private setSpeaking(next: boolean) {
    if (this.speaking === next) return;

    this.speaking = next;
    for (const listener of this.speakingListeners) listener(next);
  }
}

let browserSpeechOutputAdapterSingleton: OrionSpeechAdapter | null = null;

export function getBrowserSpeechOutputAdapter(): OrionSpeechAdapter {
  if (!browserSpeechOutputAdapterSingleton) {
    browserSpeechOutputAdapterSingleton = new BrowserSpeechOutputAdapter();
  }

  return browserSpeechOutputAdapterSingleton;
}
