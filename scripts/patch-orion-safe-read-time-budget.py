from pathlib import Path

executor_path = Path("lib/orion/autonomy/safe-read-executor.ts")
text = executor_path.read_text()

text = text.replace(
'''  stopReason: "plan_boundary" | "write_boundary" | "authorization_failed" | "validation_failed" | "execution_failed" | null;''',
'''  stopReason: "plan_boundary" | "write_boundary" | "time_budget_exceeded" | "authorization_failed" | "validation_failed" | "execution_failed" | null;''',
1,
)
text = text.replace(
'''const MAX_PARALLEL_SAFE_READS = 4;
const MAX_SAFE_READ_ATTEMPTS = 2;''',
'''const MAX_PARALLEL_SAFE_READS = 4;
const MAX_SAFE_READ_ATTEMPTS = 2;
const MAX_SAFE_READ_SEQUENCE_MS = 12_000;''',
1,
)
text = text.replace(
'''  const registry = createOrionCommandRegistry();
  const router = createOrionCommandRouter({ supabase: args.supabase });
  const executed: OrionSafeReadExecutionStep[] = [];
  const outputs: OrionStepReferenceOutput[] = [];''',
'''  const registry = createOrionCommandRegistry();
  const router = createOrionCommandRouter({ supabase: args.supabase });
  const executed: OrionSafeReadExecutionStep[] = [];
  const outputs: OrionStepReferenceOutput[] = [];
  const sequenceStartedAt = Date.now();''',
1,
)
needle = '''  let zeroIndex = 0;
  while (zeroIndex < planned.plan.autonomousPrefixLength) {
    const currentParams = asParams(args.steps[zeroIndex]?.params);'''
replacement = '''  let zeroIndex = 0;
  while (zeroIndex < planned.plan.autonomousPrefixLength) {
    if (Date.now() - sequenceStartedAt >= MAX_SAFE_READ_SEQUENCE_MS) {
      return {
        ok: true,
        executed,
        stoppedAt: zeroIndex + 1,
        stopReason: "time_budget_exceeded",
        nextBlockedStep: planned.plan.steps[zeroIndex] ?? null,
        nextBlockedAction: null,
      };
    }

    const currentParams = asParams(args.steps[zeroIndex]?.params);'''
if needle not in text:
    raise SystemExit("batch loop anchor missing")
text = text.replace(needle, replacement, 1)
executor_path.write_text(text)

contract_path = Path("lib/orion/autonomy/orion-safe-read-time-budget.contract.test.ts")
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
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  console.log("\nOrion safe-read time-budget contract");
  assert(executor.includes("const MAX_SAFE_READ_SEQUENCE_MS = 12_000"), "server enforces a fixed twelve-second safe-read sequence budget");
  assert(executor.includes("const sequenceStartedAt = Date.now()"), "time budget starts inside the authenticated guarded executor");
  assert(executor.includes("Date.now() - sequenceStartedAt >= MAX_SAFE_READ_SEQUENCE_MS"), "budget is checked before starting each new autonomous read batch");
  assert(executor.includes('stopReason: "time_budget_exceeded"'), "budget exhaustion stops future autonomous work explicitly");
  assert(executor.includes("stoppedAt: zeroIndex + 1"), "budget stop identifies the first unexecuted step");
  assert(executor.includes("nextBlockedStep: planned.plan.steps[zeroIndex] ?? null"), "budget stop preserves the exact next planned step for a later continuation");
  assert(executor.includes("nextBlockedAction: null"), "time-budget exhaustion never creates a protected-action bypass handoff");
  assert(executor.includes("const MAX_PARALLEL_SAFE_READS = 4") && executor.includes("const MAX_SAFE_READ_ATTEMPTS = 2"), "existing parallel and retry caps remain intact");
  assert(bridge.includes("stopReason: payload.stopReason ?? null"), "Realtime already receives the explicit budget stop reason");
  console.log(`\nOrion safe-read time-budget results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
main();
''')
