import assert from "node:assert/strict";
import { microphoneConstraints, voiceIsolationInstruction } from "./voice-isolation";

const focused = microphoneConstraints("focused");
assert.deepEqual(focused.channelCount, { ideal: 1 });
assert.deepEqual(focused.echoCancellation, { ideal: true });
assert.deepEqual(focused.noiseSuppression, { ideal: true });
assert.deepEqual(focused.autoGainControl, { ideal: false });
assert.match(voiceIsolationInstruction("focused"), /unrelated room conversation/);
assert.match(voiceIsolationInstruction("focused"), /Never use voice isolation as proof of identity/);
console.log("Orion focused voice-isolation tests passed");
