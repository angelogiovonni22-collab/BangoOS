import { buildVoiceConfirmationSummary, voiceConfirmationRequired } from "./voice-confirmation";
import { parseVoiceConfirmationPhrase, resolveSpokenCandidate, sanitizeTranscript } from "./voice-transcript";

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

function main() {
  test("1. accepted confirmation phrases", () => {
    assert(parseVoiceConfirmationPhrase("Confirm") === "confirm", "confirm phrase accepted");
    assert(parseVoiceConfirmationPhrase("Yes, continue") === "confirm", "yes continue phrase accepted");
    assert(parseVoiceConfirmationPhrase("Approve") === "confirm", "approve phrase accepted");
  });

  test("2. cancel phrases", () => {
    assert(parseVoiceConfirmationPhrase("Cancel") === "cancel", "cancel phrase accepted");
    assert(parseVoiceConfirmationPhrase("No, stop") === "cancel", "no stop phrase accepted");
  });

  test("3. action transcript is not confirmation", () => {
    assert(parseVoiceConfirmationPhrase("record a four thousand dollar deposit") === null, "action phrase does not count as confirmation");
  });

  test("4. spoken candidate selection", () => {
    const candidates = [
      { entityType: "project", entityId: "p1", label: "Kelly Johnson Kitchen", subtitle: "Project" },
      { entityType: "project", entityId: "p2", label: "Kelly Johnson Remodel", subtitle: "Project" },
    ];

    const byNumber = resolveSpokenCandidate("number 2", candidates);
    assert(byNumber?.entityId === "p2", "candidate can be selected by spoken number");

    const byName = resolveSpokenCandidate("kelly johnson kitchen", candidates);
    assert(byName?.entityId === "p1", "candidate can be selected by spoken name");
  });

  test("5. required command summary", () => {
    const summary = buildVoiceConfirmationSummary({
      transcript: "record a four-thousand-dollar deposit",
      preview: {
        commandId: "invoice.record_deposit",
        target: "INV-2044",
        confirmationLevel: "REQUIRED",
        expectedOutcome: "Record deposit and publish event.",
        eventsThatWillPublish: ["invoice.deposit.recorded"],
      },
      amountText: "$4,000",
    });

    assert(summary.includes("Command invoice.record_deposit"), "summary includes command id");
    assert(summary.includes("Target INV-2044"), "summary includes target");
    assert(summary.includes("$4,000"), "summary includes amount");
    assert(summary.includes("invoice.deposit.recorded"), "summary includes publish events");
  });

  test("6. confirmation levels", () => {
    assert(!voiceConfirmationRequired("NONE"), "NONE does not require confirmation");
    assert(!voiceConfirmationRequired("REVIEW"), "REVIEW does not require confirmation");
    assert(voiceConfirmationRequired("REQUIRED"), "REQUIRED requires confirmation");
  });

  test("7. transcript cleanup", () => {
    assert(sanitizeTranscript("  open   project   ") === "open project", "transcript spaces are normalized");
  });

  console.log(`\nPhase 7D voice transcript/confirmation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
