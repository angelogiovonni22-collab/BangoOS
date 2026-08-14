import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function main() {
  const adapter = read("lib/orion/voice/speech-output-adapter.ts");
  const provider = read("components/orion/voice/GlobalOrionVoiceProvider.tsx");
  const settingsPanel = read("components/orion/voice/OrionVoiceSettingsPanel.tsx");

  test("1. adapter exposes canonical speech output API", () => {
    assert(adapter.includes("type OrionSpeechAdapter"), "speech adapter interface exists");
    assert(adapter.includes("speak: (text: string") && adapter.includes("preview: (text: string"), "adapter includes speak and preview methods");
    assert(adapter.includes("cancel: () => void") && adapter.includes("pause: () => void") && adapter.includes("resume: () => void"), "adapter includes cancel, pause, and resume methods");
    assert(adapter.includes("subscribeToVoiceLevel") && adapter.includes("getAvailableVoices"), "adapter exposes voice-level and voices list subscriptions");
  });

  test("2. available voices refresh on voiceschanged", () => {
    assert(adapter.includes("addEventListener(\"voiceschanged\""), "voiceschanged listener is registered");
    assert(adapter.includes("listener(voices);"), "updated voices are pushed to subscribers");
  });

  test("3. natural English and Australian voice ranking exists", () => {
    assert(adapter.includes("isEnglishVoice") && adapter.includes("scoreVoice"), "voice ranking helpers exist");
    assert(adapter.includes("NATURAL_VOICE_PATTERN") && adapter.includes("neural|natural|premium|enhanced|online"), "premium neural quality metadata is considered");
    assert(adapter.includes("isAustralianVoice") && adapter.includes("en-au"), "Australian English voices are detected explicitly");
    assert(adapter.includes("FEMININE_VOICE_PATTERN"), "recommended natural female-style browser voices receive preference scoring");
  });

  test("4. saved voice resolves by voiceURI with fallback id", () => {
    assert(adapter.includes("voice.voiceURI === voiceId"), "saved voice resolves by voiceURI");
    assert(adapter.includes("`${voice.name}|${voice.lang}`"), "fallback voice id composite exists");
  });

  test("5. provider persists and exposes per-user voice settings", () => {
    assert(provider.includes("voiceId: string | null"), "provider settings include voiceId");
    assert(provider.includes("const storageKey = useMemo") && provider.includes("company.userId") && provider.includes("company.companyId"), "settings storage key remains scoped per user and company");
    assert(provider.includes("setVoiceId") && provider.includes("setVoiceRate") && provider.includes("setVoicePitch") && provider.includes("setVoiceVolume"), "provider exposes voice settings mutators");
  });

  test("6. preview flow uses selected settings and does not route to intent", () => {
    const previewBlock = provider.split("const previewVoice = useCallback(")[1] || "";
    assert(provider.includes("previewVoice") && provider.includes("speechAdapterRef.current.preview"), "provider preview uses adapter preview path");
    assert(provider.includes("voiceId: settings.voiceId") && provider.includes("rate: settings.voiceRate") && provider.includes("pitch: settings.voicePitch") && provider.includes("volume: settings.voiceVolume"), "preview applies selected voice and tuning values");
    assert(!previewBlock.includes("mode: \"intent\""), "preview flow does not invoke intent endpoint");
  });

  test("7. settings panel controls the active Realtime voice architecture", () => {
    assert(settingsPanel.includes("Orion voice") && settingsPanel.includes("Turning voice off disconnects Orion"), "voice Off clearly describes Realtime microphone disconnection");
    assert(settingsPanel.includes("useOrionUnifiedVoice") && settingsPanel.includes("setSpokenResponsesEnabled"), "settings operate on the shared Realtime controller");
    assert(settingsPanel.includes("availableRealtimeVoices") && settingsPanel.includes("setRealtimeVoice"), "settings render the canonical Realtime voice catalog");
    assert(settingsPanel.includes("★ Recommended — Marin") && settingsPanel.includes("Marin is recommended"), "recommended natural Realtime voice is visible");
    assert(!settingsPanel.includes("speechSynthesis") && !settingsPanel.includes("Preview voice"), "retired browser TTS cannot create a second spoken response");
  });

  console.log(`\nPhase 10A voice selection results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
