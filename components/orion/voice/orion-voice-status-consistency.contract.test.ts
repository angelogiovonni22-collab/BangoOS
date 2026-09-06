import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const status = fs.readFileSync(path.join(root, "components/orion/voice/OrionVoiceStatus.tsx"), "utf8");

assert(status.includes('state === "listening" && message.trim() === "Orion v2 is ready."'), "ready-but-not-capturing Orion state must not render as active listening");
assert(status.includes('return "ready"'), "pre-capture Orion status must render as ready");
assert(status.includes("return state"), "active voice pipeline states must pass through unchanged");

console.log("Orion voice status consistency contract passed");
