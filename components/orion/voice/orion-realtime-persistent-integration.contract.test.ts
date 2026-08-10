import fs from "node:fs";
import path from "node:path";

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

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const unified = read("components/orion/voice/useOrionUnifiedVoice.ts");
  const compat = read("components/orion/voice/useGlobalOrionVoiceCompat.ts");
  const voiceIndex = read("components/orion/voice/index.ts");
  const commandCenter = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");
  const persistent = read("components/orion/persistent/PersistentOrion.tsx");
  const panel = read("components/orion/persistent/PersistentOrionPanel.tsx");
  const realtimeClient = read("lib/orion/realtime/client.ts");
  const realtimeSession = read("app/api/orion/realtime/session/route.ts");
  const modelConfig = read("lib/orion/intelligence/model-config.ts");

  console.log("\nOrion v2 persistent Realtime integration contract");

  assert(unified.includes("new OrionRealtimeClient"), "Orion v2 owns one Realtime client");
  assert(unified.includes("shutDownLegacyVoice"), "legacy browser voice is explicitly shut down before Realtime owns the microphone");
  assert(unified.includes("stopAllListening()") && unified.includes("disableGlobalVoice()"), "legacy recognition cannot remain active beside Orion v2");
  assert(!unified.includes("fallbackToBrowser"), "Realtime failures cannot fall through to the legacy deterministic browser engine");
  assert(!unified.includes("startCurrentBrowserCapture"), "Orion v2 never resumes legacy browser command capture");
  assert(unified.includes('engine: "realtime" as const'), "the public unified controller exposes Realtime as the single execution engine");
  assert(unified.includes("ORION_V2_ENABLED_STORAGE_KEY"), "Orion v2 enablement persists independently of legacy voice settings");
  assert(unified.includes("autoStartAttemptedRef") && unified.includes("void start()"), "enabled Orion v2 reconnects its persistent conversation on mount");
  assert(unified.includes('result.href.startsWith("/")') && unified.includes("router.push(result.href)"), "successful Realtime BOS navigation remains inside BOS routing");
  assert(unified.includes('response.output_audio.delta') && unified.includes('response.output_audio.done'), "Realtime speaking state is projected into the persistent Orion surface");
  assert(unified.includes('conversation.item.input_audio_transcription.completed'), "Realtime user transcripts are projected into Orion state");
  assert(unified.includes("isOrionVoiceAutomationEnabled") && unified.includes("ORION_VOICE_FREEZE_MESSAGE"), "Orion v2 preserves the emergency voice gate");
  assert(realtimeSession.includes("isOrionVoiceAutomationEnabled") && realtimeSession.includes('statusCategory: "voice_automation_paused"'), "Realtime session API independently enforces the emergency voice gate");
  assert(persistent.includes("const voice = useOrionUnifiedVoice()"), "persistent Orion root owns the single unified controller");
  assert(persistent.includes("voice={voice}"), "persistent Orion passes the shared controller into its panel");
  assert(panel.includes("voice: OrionUnifiedVoiceController"), "persistent panel receives the shared unified controller by contract");
  assert(!panel.includes("useOrionUnifiedVoice()"), "persistent panel cannot create a second Realtime controller");
  assert(persistent.includes("micActive={voice.micActive}") && persistent.includes("voicePhase={voice.phase}"), "floating Orion sphere shares the same Realtime state as the panel");
  assert(panel.includes("Engine: ORION V2 · OPENAI REALTIME"), "persistent Orion visibly identifies the v2 engine");
  assert(!panel.includes("Browser fallback"), "the persistent UI no longer advertises the retired legacy fallback");
  assert(panel.includes("void voice.start()") && panel.includes("void voice.stop()"), "persistent voice controls start and stop the Realtime conversation");
  assert(realtimeClient.includes("await this.disconnect()"), "Realtime client remains single-session before acquiring microphone resources");
  assert(unified.includes('DEFAULT_REALTIME_VOICE: OrionRealtimeVoice = "marin"'), "Realtime defaults to the recommended Orion voice");
  assert(unified.includes("client.connect({ voice: realtimeVoice })"), "selected Realtime voice is used when the session connects");
  assert(modelConfig.includes('DEFAULT_REALTIME_MODEL = "gpt-realtime"'), "Orion v2 defaults to the public OpenAI Realtime model identifier");
  assert(modelConfig.includes('DEFAULT_REASONING_MODEL = "gpt-5.1"'), "non-Realtime Orion reasoning defaults to a public API model identifier");
  assert(modelConfig.includes('DEFAULT_FAST_MODEL = "gpt-5-mini"'), "fast Orion reasoning defaults to a public API model identifier");

  assert(commandCenter.includes('from "@/components/orion/voice"'), "Command Center consumes the public Orion voice facade rather than the provider implementation directly");
  assert(voiceIndex.includes('useGlobalOrionVoice } from "./useGlobalOrionVoiceCompat"'), "the public legacy-shaped hook is routed through the Realtime compatibility facade");
  assert(!voiceIndex.includes('GlobalOrionVoiceProvider, useGlobalOrionVoice'), "the barrel no longer exports the legacy provider hook to command surfaces");
  assert(compat.includes("useOrionUnifiedVoice()"), "the compatibility facade is backed by Orion v2 Realtime");
  assert(compat.includes('finalTranscript: ""'), "Realtime final transcripts cannot be re-dispatched into the legacy Command Center intent pipeline");
  assert(compat.includes("requestSpokenResponse: noop"), "browser TTS cannot duplicate Realtime spoken output while preserving legacy call signatures");
  assert(compat.includes("(..._args: unknown[])"), "legacy-shaped no-op methods accept their historical arguments without reactivating legacy voice behavior");

  console.log(`\nOrion v2 persistent Realtime integration results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();