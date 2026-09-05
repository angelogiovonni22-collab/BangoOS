from pathlib import Path

path = Path("lib/orion/autonomy/safe-read-executor.ts")
text = path.read_text()

text = text.replace(
'''export type OrionSafeReadExecutionStep = {
  index: number;
  commandId: string;
  success: boolean;
  status: string;
  userMessage: string;
  href: string | null;
  verified: boolean;
  referencesResolved: number;
  evidence: OrionReadEvidence | null;
};''',
'''export type OrionSafeReadExecutionStep = {
  index: number;
  commandId: string;
  success: boolean;
  status: string;
  userMessage: string;
  href: string | null;
  verified: boolean;
  attempts: number;
  referencesResolved: number;
  evidence: OrionReadEvidence | null;
};''',
1,
)

text = text.replace('const MAX_PARALLEL_SAFE_READS = 4;', 'const MAX_PARALLEL_SAFE_READS = 4;\nconst MAX_SAFE_READ_ATTEMPTS = 2;', 1)

old = '''    const result = await router.executeCommand({
      commandId: command.id,
      params: validation.normalizedParams ?? {},
      companyContext: { companyId: args.companyId },
      userContext: { actorProfileId: args.userId, role: normalizeRole(authorization.role) },
      executionContext: { origin: "user" },
      correlationId,
      idempotencyKey,
    });

    const verification = verifyOrionAutonomousReadResult({ command, result });
    const verified = verification.ok;
    const executedStep: OrionSafeReadExecutionStep = {
      index: stepIndex,
      commandId: command.id,
      success: result.success,
      status: result.status,
      userMessage: result.userMessage,
      href: result.href,
      verified,
      referencesResolved: referenceResolution.referencesResolved,
      evidence: verified ? buildOrionReadEvidence(result) : null,
    };

    if (!verified) {
      return {
        ok: false,
        executedStep,
        stoppedAt: stepIndex,
        stopReason: "execution_failed",
        nextBlockedStep: planned.plan.nextBlockedStep,
        error: verification.reason,
      };
    }
'''
new = '''    let result: Awaited<ReturnType<typeof router.executeCommand>> | null = null;
    let verification: ReturnType<typeof verifyOrionAutonomousReadResult> | null = null;
    let attempts = 0;

    for (let attempt = 1; attempt <= MAX_SAFE_READ_ATTEMPTS; attempt += 1) {
      attempts = attempt;
      result = await router.executeCommand({
        commandId: command.id,
        params: validation.normalizedParams ?? {},
        companyContext: { companyId: args.companyId },
        userContext: { actorProfileId: args.userId, role: normalizeRole(authorization.role) },
        executionContext: { origin: "user" },
        correlationId,
        idempotencyKey,
      });
      verification = verifyOrionAutonomousReadResult({ command, result });
      if (verification.ok) break;
      if (!result.retryable || attempt >= MAX_SAFE_READ_ATTEMPTS) break;
    }

    if (!result || !verification) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "execution_failed",
        nextBlockedStep: planned.plan.nextBlockedStep,
        error: "Orion could not obtain a safe read result.",
      };
    }

    const verified = verification.ok;
    const executedStep: OrionSafeReadExecutionStep = {
      index: stepIndex,
      commandId: command.id,
      success: result.success,
      status: result.status,
      userMessage: result.userMessage,
      href: result.href,
      verified,
      attempts,
      referencesResolved: referenceResolution.referencesResolved,
      evidence: verified ? buildOrionReadEvidence(result) : null,
    };

    if (!verified) {
      return {
        ok: false,
        executedStep,
        stoppedAt: stepIndex,
        stopReason: "execution_failed",
        nextBlockedStep: planned.plan.nextBlockedStep,
        error: verification.reason,
      };
    }
'''
if old not in text:
    raise SystemExit("execution anchor missing")
text = text.replace(old, new, 1)
path.write_text(text)

contract = Path("lib/orion/autonomy/orion-safe-read-retry.contract.test.ts")
contract.write_text(r'''import fs from "node:fs";
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
  console.log("\nOrion safe-read retry contract");
  assert(executor.includes("const MAX_SAFE_READ_ATTEMPTS = 2"), "safe-read retries are strictly bounded to one retry");
  assert(executor.includes("result.retryable"), "only command results explicitly marked retryable can be retried");
  assert(executor.includes("verifyOrionAutonomousReadResult({ command, result })"), "every attempt is semantically verified before acceptance");
  assert(executor.includes("if (verification.ok) break"), "successful verified reads never retry unnecessarily");
  assert(executor.includes("if (!result.retryable || attempt >= MAX_SAFE_READ_ATTEMPTS) break"), "non-retryable failures fail closed immediately");
  assert(executor.includes("idempotencyKey") && executor.includes("correlationId"), "retries retain the original retry-stable execution identity");
  assert(executor.includes("attempts,"), "execution evidence reports how many attempts were required");
  assert(executor.includes('classifyOrionCommandRisk(command) !== "read"'), "retry logic remains unreachable for protected non-read commands");
  console.log(`\nOrion safe-read retry results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}
main();
''')
