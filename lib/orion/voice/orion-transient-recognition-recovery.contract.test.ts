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

function main() {
  const source = fs.readFileSync(path.resolve(process.cwd(), "lib/orion/voice/voice-session.ts"), "utf8");

  console.log("\nOrion transient recognition recovery contract");

  assert(source.includes('TRANSIENT_RECOGNITION_ERRORS = new Set(["network", "bad-grammar"])'), "known transient browser recognition errors are explicitly classified");
  assert(source.includes("TRANSIENT_RECOGNITION_ERRORS.has(event.error)"), "transient recognition errors use the recovery path");
  assert(source.includes('setErrorCategory(null);'), "recovery clears stale voice error category");
  assert(source.includes('setState(support.recognitionSupported ? "idle" : "unsupported");'), "transient recognition failure returns the session to a recoverable idle state");
  assert(source.includes('event.error === "not-allowed" || event.error === "service-not-allowed"'), "permission failures remain fatal and explicit");
  assert(source.includes('event.error === "audio-capture"'), "hardware capture failures remain fatal and explicit");

  console.log(`\nOrion transient recognition recovery results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
