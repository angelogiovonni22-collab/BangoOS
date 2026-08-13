import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const unified = read("../../../components/orion/voice/useOrionUnifiedVoice.ts");
const client = read("../realtime/client.ts");

assert.match(unified, /detectRealtimeVoiceControl\(userTranscript\)/, "voice controls must run on the active Realtime transcript path");
assert.match(unified, /client\.setOutputMuted\(true\)/, "disable voice must mute Realtime output");
assert.match(unified, /client\.setOutputMuted\(false\)/, "enable voice must restore Realtime output");
assert.match(unified, /Say “Orion, enable voice”/, "muted mode must explain its voice-safe recovery command");
assert.doesNotMatch(unified, /const setSpokenResponsesEnabled[\s\S]{0,240}void disableVoice\(\)/, "muting spoken output must not disconnect the microphone needed for voice reactivation");
assert.match(client, /remoteAudio\.muted = this\.outputMuted/, "new audio elements must inherit the saved mute state");
assert.match(client, /setOutputMuted\(muted: boolean\)/, "Realtime client must expose output isolation without tearing down input");

console.log("Orion Realtime voice-control contract passed");
