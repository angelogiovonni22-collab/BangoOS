import assert from "node:assert/strict";
import { detectRealtimeVoiceControl } from "./realtime-voice-controls.ts";

assert.equal(detectRealtimeVoiceControl("Orion, disable voice"), "mute_output");
assert.equal(detectRealtimeVoiceControl("Hey Orion, turn your voice off."), "mute_output");
assert.equal(detectRealtimeVoiceControl("Orion enable voice"), "unmute_output");
assert.equal(detectRealtimeVoiceControl("Okay Orion, unmute your voice"), "unmute_output");
assert.equal(detectRealtimeVoiceControl("Orion open voice settings"), null);
assert.equal(detectRealtimeVoiceControl("stop the concrete pour"), null);

console.log("Orion Realtime voice-control tests passed");
