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
  const route = read("app/api/orion/realtime/session/route.ts");
  const client = read("lib/orion/realtime/client.ts");
  const config = read("lib/orion/intelligence/model-config.ts");

  console.log("\nOrion Realtime foundation contract");

  assert(route.includes('https://api.openai.com/v1/realtime/calls'), "server creates Realtime WebRTC calls through OpenAI");
  assert(route.includes("Authorization: `Bearer ${apiKey}`"), "OpenAI API key remains server-side");
  assert(route.includes('type: "semantic_vad"') && route.includes('eagerness: "high"'), "Realtime uses fast semantic turn detection");
  assert(route.includes('interrupt_response: true'), "Realtime allows natural user interruption");
  assert(route.includes('noise_reduction: { type: "far_field" }'), "Realtime applies far-field microphone noise reduction");
  assert(route.includes('tool_choice: "none"'), "Realtime cannot bypass BOS command controls before tool bridge is wired");
  assert(client.includes("new RTCPeerConnection()"), "browser client uses WebRTC");
  assert(client.includes("navigator.mediaDevices.getUserMedia"), "browser client captures microphone audio");
  assert(client.includes('createDataChannel("oai-events")'), "browser client exposes Realtime event channel");
  assert(config.includes('DEFAULT_REALTIME_MODEL = "gpt-realtime"'), "Orion uses the GA realtime model by default");

  console.log(`\nOrion Realtime foundation results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
