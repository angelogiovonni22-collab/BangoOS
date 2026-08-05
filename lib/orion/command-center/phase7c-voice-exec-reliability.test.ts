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

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const overlay = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");
  const route = read("app/api/orion/command-center/route.ts");

  function countMatches(source: string, pattern: RegExp) {
    return (source.match(pattern) || []).length;
  }

  test("1. explicit workspace context states are present", () => {
    assert(overlay.includes('"loading"') && overlay.includes('"ready"') && overlay.includes('"no_workspace"'), "overlay defines context states");
    assert(overlay.includes('"permission_denied"') && overlay.includes('"authentication_required"') && overlay.includes('"error"'), "overlay includes all required context error states");
  });

  test("2. retry and abort handling", () => {
    assert(overlay.includes("AbortController"), "overlay uses abort controllers");
    assert(overlay.includes("Retry"), "overlay includes retry action");
    assert(overlay.includes("controller.abort()"), "overlay aborts stale requests");
  });

  test("3. command execution sends correlation and idempotency", () => {
    assert(overlay.includes("correlationId") && overlay.includes("idempotencyKey"), "overlay submits correlation and idempotency fields");
    assert(route.includes("correlationId") && route.includes("idempotencyKey"), "API route accepts correlation and idempotency fields");
  });

  test("4. command validation before execution", () => {
    assert(route.includes("createOrionCommandRegistry"), "route resolves command IDs from registry");
    assert(route.includes("command.validate"), "route validates command params before execution");
  });

  test("5. normalized voice error categories are surfaced", () => {
    assert(overlay.includes("Voice error category:"), "overlay renders voice error category");
    assert(overlay.includes("command_validation_failed") && overlay.includes("network_error"), "overlay handles categorized failures");
  });

  test("6. context lookup reuse and timing instrumentation are present", () => {
    assert(route.includes("requestContextCache") && route.includes("REQUEST_CONTEXT_TTL_MS"), "API route reuses resolved request context briefly");
    assert(route.includes("x-orion-company-id") && route.includes("x-orion-context-hint"), "API route supports workspace-scoped context cache hints");
    assert(route.includes("[orion-timing] context.lookup.end") || route.includes("logApiTiming(\"context.lookup.end\""), "API emits context timing marks");
  });

  test("7. command validation and execution timing marks are present", () => {
    assert(route.includes("logApiTiming(\"command.validation.end\""), "API emits command validation timing");
    assert(route.includes("logApiTiming(\"command.execute.end\""), "API emits command execution timing");
    assert(route.includes("logApiTiming(\"intent.request.end\""), "API emits intent timing");
    assert(route.includes("return NextResponse.json({ ok: true, result });"), "API execution success path returns a 200 JSON result envelope");
  });

  test("8. deterministic navigation command IDs match command guard expectations", () => {
    assert(overlay.includes('nextIntent.suggestedCommand.commandId === "dashboard.open"'), "overlay recognizes dashboard.open deterministic command");
    assert(overlay.includes('const hasKnownCommand = Boolean(catalog?.actions.some((action) => action.commandId === params.commandId));'), "overlay keeps hasKnownCommand guard");
    assert(overlay.includes('setVoiceStatusMessage(`Opening ${destination}.`);'), "overlay shows executing navigation status for dashboard/open routes");
  });

  test("9. voice final transcript path executes command and navigation once", () => {
    assert(overlay.includes("useGlobalOrionVoice") && overlay.includes("const voice = {"), "overlay subscribes to global provider transcript/session path");
    assert(countMatches(overlay, /logVoiceTiming\("intent\.request\.start"/g) === 1, "voice intent request start marker exists once");
    assert(countMatches(overlay, /logVoiceTiming\("command\.execute\.start"/g) === 1, "voice command execute start marker exists once");
    assert(countMatches(overlay, /logVoiceTiming\("command\.execute\.end"/g) === 1, "voice command execute end marker exists once");
    assert(countMatches(overlay, /logVoiceTiming\("navigation\.start"/g) === 1, "voice navigation start marker exists once");
    assert(countMatches(overlay, /logVoiceTiming\("navigation\.complete"/g) === 1, "voice navigation complete marker exists once");
  });

  console.log(`\nPhase 7C voice execution reliability results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
