from pathlib import Path

executor_path = Path("lib/orion/autonomy/safe-read-executor.ts")
executor = executor_path.read_text()
executor = executor.replace(
'''  verified: boolean;
  attempts: number;
  referencesResolved: number;''',
'''  verified: boolean;
  attempts: number;
  durationMs: number;
  referencesResolved: number;''',
1,
)
executor = executor.replace(
'''    const stepIndex = zeroIndex + 1;
    const planStep = planned.plan.steps[zeroIndex];''',
'''    const stepIndex = zeroIndex + 1;
    const stepStartedAt = Date.now();
    const planStep = planned.plan.steps[zeroIndex];''',
1,
)
executor = executor.replace(
'''      verified,
      attempts,
      referencesResolved: referenceResolution.referencesResolved,''',
'''      verified,
      attempts,
      durationMs: Math.max(0, Date.now() - stepStartedAt),
      referencesResolved: referenceResolution.referencesResolved,''',
1,
)
executor_path.write_text(executor)

route_path = Path("app/api/orion/autonomy/execute-safe-read/route.ts")
route = route_path.read_text()
route = route.replace(
'''    const result = await executeOrionSafeReadPrefix({''',
'''    const sequenceStartedAt = Date.now();
    const result = await executeOrionSafeReadPrefix({''',
1,
)
route = route.replace(
'''    return NextResponse.json(result, { status: result.ok ? 200 : 400 });''',
'''    const durationMs = Math.max(0, Date.now() - sequenceStartedAt);
    const retries = result.executed.reduce((total, step) => total + Math.max(0, step.attempts - 1), 0);
    const slowestStepMs = result.executed.reduce((max, step) => Math.max(max, step.durationMs), 0);
    const response = NextResponse.json({
      ...result,
      telemetry: {
        durationMs,
        executedSteps: result.executed.length,
        retries,
        slowestStepMs,
      },
    }, { status: result.ok ? 200 : 400 });
    response.headers.set("Server-Timing", `orion-safe-read;dur=${durationMs}`);
    return response;''',
1,
)
route_path.write_text(route)

bridge_path = Path("lib/orion/realtime/tool-bridge.ts")
bridge = bridge_path.read_text()
bridge = bridge.replace(
'''    nextBlockedAction?: unknown;
  };''',
'''    nextBlockedAction?: unknown;
    telemetry?: unknown;
  };''',
1,
)
bridge = bridge.replace(
'''      nextBlockedAction: payload.nextBlockedAction ?? null,
    },''',
'''      nextBlockedAction: payload.nextBlockedAction ?? null,
      telemetry: payload.telemetry ?? null,
    },''',
1,
)
bridge_path.write_text(bridge)

contract_path = Path("lib/orion/autonomy/orion-autonomy-telemetry.contract.test.ts")
contract_path.write_text(r'''import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  + ${message}`); passed += 1; }
  else { console.error(`  x FAIL: ${message}`); failed += 1; }
}
function read(relativePath: string) { return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8"); }

function main() {
  const executor = read("lib/orion/autonomy/safe-read-executor.ts");
  const route = read("app/api/orion/autonomy/execute-safe-read/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  console.log("\nOrion autonomy telemetry contract");
  assert(executor.includes("durationMs: number"), "each completed autonomous read exposes bounded latency metadata");
  assert(executor.includes("const stepStartedAt = Date.now()"), "read-step timing begins inside the guarded executor");
  assert(executor.includes("Math.max(0, Date.now() - stepStartedAt)"), "read-step duration cannot become negative");
  assert(route.includes("const sequenceStartedAt = Date.now()"), "sequence latency is measured server-side");
  assert(route.includes("executedSteps: result.executed.length"), "sequence telemetry reports completed-step count without payload data");
  assert(route.includes("step.attempts - 1"), "sequence telemetry reports bounded retry count");
  assert(route.includes("slowestStepMs"), "sequence telemetry identifies latency pressure without exposing command parameters");
  assert(route.includes('response.headers.set("Server-Timing"'), "safe-read latency is observable through a standard server timing header");
  assert(bridge.includes("telemetry: payload.telemetry ?? null"), "Realtime receives safe aggregate telemetry with the guarded result");
  assert(!route.includes("telemetry: { params") && !route.includes("telemetry: { details"), "telemetry does not copy user parameters or command result details");
  console.log(`\nOrion autonomy telemetry results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
main();
''')
