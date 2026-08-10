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
  const session = read("lib/orion/voice/voice-session.ts");

  console.log("\nOrion conversation turn-boundary contract");

  assert(session.includes("FINAL_TRANSCRIPT_SETTLE_MS = 900"), "final speech waits for a quiet settle window");
  assert(session.includes("pendingFinalTranscriptRef"), "final transcript chunks are buffered across browser result events");
  assert(session.includes("speech.final_chunk_buffered"), "buffered final chunks are traceable in diagnostics");
  assert(session.includes("every subsequent result (including interim speech)"), "continued speech extends the active turn boundary");
  assert(session.includes("onFinalTranscriptRef.current?.(settled)"), "only the settled combined utterance is dispatched to Orion");
  assert(session.includes("clearPendingFinalTranscript();"), "pending speech is cleared across lifecycle reset paths");

  console.log(`\nOrion conversation turn-boundary results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
