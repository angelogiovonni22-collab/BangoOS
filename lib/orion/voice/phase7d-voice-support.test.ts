import { detectOrionVoiceSupport, resolveSpeechRecognitionCtor } from "./voice-support";

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
  test("1. unsupported browser fallback", () => {
    const support = detectOrionVoiceSupport(null);
    assert(!support.recognitionSupported, "recognition is unsupported without window");
    assert(support.message.includes("Voice control is not supported in this browser"), "unsupported message is explicit");
  });

  test("2. microphone feature detection", () => {
    const fakeWindow = {
      SpeechRecognition: function FakeRecognition() {
        return {
          lang: "en-US",
          interimResults: true,
          continuous: false,
          maxAlternatives: 1,
          onstart: null,
          onresult: null,
          onerror: null,
          onend: null,
          start() {},
          stop() {},
          abort() {},
        };
      },
      speechSynthesis: {
        speak() {},
      },
    } as unknown as Window;

    const ctor = resolveSpeechRecognitionCtor(fakeWindow);
    assert(Boolean(ctor), "speech recognition constructor is detected");

    const support = detectOrionVoiceSupport(fakeWindow);
    assert(support.recognitionSupported, "recognition is supported when constructor exists");
    assert(support.synthesisSupported, "synthesis is supported when speechSynthesis exists");
  });

  console.log(`\nPhase 7D voice support results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
