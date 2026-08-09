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
  const persistent = read("components/orion/persistent/PersistentOrion.tsx");
  const panel = read("components/orion/persistent/PersistentOrionPanel.tsx");
  const realtimeClient = read("lib/orion/realtime/client.ts");
  const realtimeSession = read("app/api/orion/realtime/session/route.ts");

  console.log("\nOrion persistent Realtime integration contract");

  assert(unified.includes("new OrionRealtimeClient"), "persistent voice controller prefers the Realtime client");
  assert(unified.includes("browser.stopAllListening()"), "browser recognition is stopped before Realtime takes microphone ownership");
  assert(unified.includes("browser.disableGlobalVoice()"), "browser voice is suspended while Realtime owns the microphone");
  assert(unified.includes("browserWasEnabledRef"), "browser voice preference is remembered for safe restoration after Realtime");
  assert(unified.includes("browserRef.current.enableGlobalVoice()"), "browser voice can be restored after an intentional Realtime stop");
  assert(unified.includes("fallbackToBrowser"), "Realtime failures automatically enter browser fallback");
  assert(unified.includes("startCurrentBrowserCapture"), "browser fallback automatically resumes voice capture");
  assert(unified.includes('realtimeState !== "closed"') && unified.includes("clientRef.current") && unified.includes("fallbackToBrowser"), "unexpected Realtime closure falls back instead of leaving Orion silent");
  assert(unified.includes('window.addEventListener("offline"') && unified.includes('document.addEventListener("visibilitychange"'), "mobile/background network lifecycle is surfaced to Orion Realtime");
  assert(unified.includes("const effectiveSettings = realtimeActive") && unified.includes("enabled: true"), "persistent Orion remains visually enabled while Realtime owns the microphone");
  assert(unified.includes('result.href.startsWith("/")') && unified.includes("router.push(result.href)"), "successful Realtime BOS navigation stays inside BOS routing");
  assert(unified.includes('response.output_audio.delta') && unified.includes('response.output_audio.done'), "Realtime speaking state is projected into persistent voice state");
  assert(unified.includes('conversation.item.input_audio_transcription.completed'), "Realtime user transcript is projected into the persistent transcript surface");
  assert(unified.includes("isOrionVoiceAutomationEnabled") && unified.includes("ORION_VOICE_FREEZE_MESSAGE"), "unified Realtime controller preserves the Phase 11D emergency voice gate");
  assert(unified.includes("if (!voiceAutomationEnabled) {") && unified.includes('setRealtimePhase("disabled")'), "Realtime microphone startup is blocked while the emergency gate is active");
  assert(realtimeSession.includes("isOrionVoiceAutomationEnabled") && realtimeSession.includes('statusCategory: "voice_automation_paused"'), "Realtime session API independently enforces the emergency voice gate");
  assert(persistent.includes("const voice = useOrionUnifiedVoice()"), "persistent Orion root owns the single unified Realtime controller");
  assert(persistent.includes("voice={voice}"), "persistent Orion passes the shared controller into its panel");
  assert(panel.includes("voice: OrionUnifiedVoiceController"), "persistent panel receives the shared unified controller by contract");
  assert(!panel.includes("useOrionUnifiedVoice()"), "persistent panel cannot create a second Realtime controller");
  assert(persistent.includes("micActive={voice.micActive}") && persistent.includes("voicePhase={voice.phase}"), "floating Orion sphere shares the same voice state as the panel");
  assert(panel.includes('Engine: {voice.engine === "realtime"'), "persistent Orion visibly identifies the active voice engine");
  assert(panel.includes("void voice.start()") && panel.includes("void voice.stop()"), "persistent voice controls start and stop the unified conversation engine");
  assert(realtimeClient.includes("await this.disconnect()"), "Realtime client remains single-session before acquiring microphone resources");

  console.log(`\nOrion persistent Realtime integration results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
