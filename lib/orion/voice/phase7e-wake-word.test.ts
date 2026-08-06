import { detectWakeWord } from "./wake-word-normalizer";
import type { OrionWakeWordPolicy } from "./wake-word-types";

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
  const policy: OrionWakeWordPolicy = { enabled: ["hey_orion", "orion", "okay_orion"] };

  test("1. wake phrase is detected", () => {
    const result = detectWakeWord("Hey Orion", policy);
    assert(result.detected, "wake phrase is detected");
    assert(result.cleanedCommand === "", "wake phrase alone does not include command");
  });

  test("2. combined wake phrase strips prefix", () => {
    const result = detectWakeWord("Hey Orion, open my dashboard", policy);
    assert(result.detected, "combined phrase is detected");
    assert(result.cleanedCommand === "open my dashboard", "wake prefix is removed from command transcript");
  });

  test("3. ordinary speech ignored before wake", () => {
    const result = detectWakeWord("please open my dashboard", policy);
    assert(!result.detected, "ordinary speech is ignored");
  });

  test("4. variant support", () => {
    const orionOnly = detectWakeWord("Orion open timeline", policy);
    const okayOrion = detectWakeWord("Okay Orion open projects", policy);
    assert(orionOnly.detected, "orion variant is detected");
    assert(okayOrion.detected, "okay orion variant is detected");
  });

  test("5. punctuation between wake words", () => {
    const withCommas = detectWakeWord("Hey, Orion, open customers", policy);
    assert(withCommas.detected, "hey orion with commas is detected");
    assert(withCommas.cleanedCommand === "open customers", "commas are stripped from wake prefix");
  });

  test("6. required wake command forms", () => {
    const samples = [
      "Hey Orion open customers",
      "Hey, Orion, open customers",
      "Orion open customers",
      "Hey Orion, open dashboard",
      "Orion dashboard",
    ];

    for (const sample of samples) {
      const result = detectWakeWord(sample, policy);
      assert(result.detected, `wake detected for: ${sample}`);
    }
  });

  console.log(`\nPhase 7E wake-word results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
