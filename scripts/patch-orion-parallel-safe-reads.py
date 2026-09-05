from pathlib import Path

path = Path("lib/orion/autonomy/safe-read-executor.ts")
text = path.read_text()

helper_anchor = '''function asParams(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
'''
helper_insert = helper_anchor + '''
function hasOrionStepReference(value: unknown, depth = 0): boolean {
  if (depth > 20) return true;
  if (typeof value === "string") return value.startsWith("$step.");
  if (Array.isArray(value)) return value.some((item) => hasOrionStepReference(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => hasOrionStepReference(item, depth + 1));
  }
  return false;
}

const MAX_PARALLEL_SAFE_READS = 4;
'''
if helper_anchor not in text:
    raise SystemExit("helper anchor missing")
text = text.replace(helper_anchor, helper_insert, 1)

start = text.index('  for (let zeroIndex = 0; zeroIndex < planned.plan.autonomousPrefixLength; zeroIndex += 1) {')
end = text.index('\n  const nextBlockedStep = planned.plan.nextBlockedStep;', start)
replacement = r'''  type StepAttempt =
    | {
        ok: true;
        executedStep: OrionSafeReadExecutionStep;
        output: OrionStepReferenceOutput;
      }
    | {
        ok: false;
        executedStep: OrionSafeReadExecutionStep | null;
        stoppedAt: number;
        stopReason: Exclude<OrionSafeReadExecutionResult["stopReason"], null>;
        nextBlockedStep: OrionAutonomyPlanStep | null;
        error: string;
      };

  const executeReadStep = async (
    zeroIndex: number,
    availableOutputs: OrionStepReferenceOutput[],
  ): Promise<StepAttempt> => {
    const stepIndex = zeroIndex + 1;
    const planStep = planned.plan.steps[zeroIndex];
    const command = registry.getById(planStep.commandId);
    if (!command) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planned.plan.nextBlockedStep,
        error: "Planned BOS command is unavailable.",
      };
    }

    if (classifyOrionCommandRisk(command) !== "read") {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "write_boundary",
        nextBlockedStep: planStep,
        error: "Autonomous safe-read execution stopped at a protected command boundary.",
      };
    }

    const authorization = await authorizeOrionCommand({
      supabase: args.supabase,
      companyId: args.companyId,
      userId: args.userId,
      command,
      legacyRoleAllowed: (membershipRole) => command.requiredPermissions.includes(normalizeRole(membershipRole)),
    });
    if (!authorization.allowed) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "authorization_failed",
        nextBlockedStep: planStep,
        error: authorization.reason,
      };
    }

    const referenceResolution = resolveOrionStepReferences({
      params: asParams(args.steps[zeroIndex]?.params),
      outputs: availableOutputs,
      currentStepIndex: stepIndex,
    });
    if (!referenceResolution.ok) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planStep,
        error: referenceResolution.error,
      };
    }

    const fastParams = await normalizeRealtimeFastCommandParams({
      supabase: args.supabase,
      companyId: args.companyId,
      commandId: command.id,
      params: asParams(referenceResolution.value),
    });
    if (fastParams.error) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planStep,
        error: fastParams.error,
      };
    }

    const validation = command.validate(fastParams.params);
    if (!validation.ok) {
      return {
        ok: false,
        executedStep: null,
        stoppedAt: stepIndex,
        stopReason: "validation_failed",
        nextBlockedStep: planStep,
        error: validation.errors.join(" ") || "BOS command validation failed.",
      };
    }

    const stepExecutionId = `${args.executionId || "orion-safe-read"}-${stepIndex}`;
    const { correlationId, idempotencyKey } = createOrionExecutionEnvelope(command.id, "orion-autonomy", stepExecutionId);
    const result = await router.executeCommand({
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

    return {
      ok: true,
      executedStep,
      output: {
        index: stepIndex,
        commandId: command.id,
        entityId: result.entityId,
        href: result.href,
        createdEntityIds: result.createdEntityIds,
        updatedEntityIds: result.updatedEntityIds,
        details: result.details,
      },
    };
  };

  let zeroIndex = 0;
  while (zeroIndex < planned.plan.autonomousPrefixLength) {
    const currentParams = asParams(args.steps[zeroIndex]?.params);
    const canParallelize = !hasOrionStepReference(currentParams);
    let batchEnd = zeroIndex + 1;

    if (canParallelize) {
      while (
        batchEnd < planned.plan.autonomousPrefixLength
        && batchEnd - zeroIndex < MAX_PARALLEL_SAFE_READS
        && !hasOrionStepReference(asParams(args.steps[batchEnd]?.params))
      ) {
        const candidate = registry.getById(planned.plan.steps[batchEnd].commandId);
        if (!candidate || classifyOrionCommandRisk(candidate) !== "read") break;
        batchEnd += 1;
      }
    }

    const indexes = Array.from({ length: batchEnd - zeroIndex }, (_, offset) => zeroIndex + offset);
    const availableOutputs = [...outputs];
    const attempts = await Promise.all(indexes.map((index) => executeReadStep(index, availableOutputs)));

    for (const attempt of attempts) {
      if (attempt.executedStep) executed.push(attempt.executedStep);
      if (!attempt.ok) {
        executed.sort((a, b) => a.index - b.index);
        return emptyResult({
          ok: false,
          executed,
          stoppedAt: attempt.stoppedAt,
          stopReason: attempt.stopReason,
          nextBlockedStep: attempt.nextBlockedStep,
          error: attempt.error,
        });
      }
      outputs.push(attempt.output);
    }

    executed.sort((a, b) => a.index - b.index);
    outputs.sort((a, b) => a.index - b.index);
    zeroIndex = batchEnd;
  }
'''
text = text[:start] + replacement + text[end:]
path.write_text(text)

# Add focused contract coverage.
test = Path("lib/orion/autonomy/orion-parallel-safe-reads.contract.test.ts")
test.write_text(r'''import fs from "node:fs";
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
  const realtime = read("app/api/orion/realtime/session/route.ts");

  console.log("\nOrion parallel safe-read contract");
  assert(executor.includes("const MAX_PARALLEL_SAFE_READS = 4"), "parallelism is explicitly bounded");
  assert(executor.includes("hasOrionStepReference"), "step references disable unsafe parallel execution");
  assert(executor.includes("Promise.all(indexes.map((index) => executeReadStep(index, availableOutputs)))"), "independent safe reads execute concurrently");
  assert(executor.includes('classifyOrionCommandRisk(candidate) !== "read"'), "batch formation stops before any protected command");
  assert(executor.includes("authorizeOrionCommand") && executor.includes("command.validate(fastParams.params)"), "each parallel read retains authorization and canonical validation");
  assert(executor.includes("verifyOrionAutonomousReadResult({ command, result })"), "each parallel read retains semantic verification");
  assert(executor.includes("executed.sort((a, b) => a.index - b.index)") && executor.includes("outputs.sort((a, b) => a.index - b.index)"), "parallel results are returned in deterministic step order");
  assert(executor.includes("createOrionExecutionEnvelope") && executor.includes("idempotencyKey"), "parallel reads retain retry-stable execution identity");
  assert(realtime.includes("maxItems: 8"), "Realtime still preserves the eight-step unattended cap");

  console.log(`\nOrion parallel safe-read results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
''')

workflow = Path(".github/workflows/orion-autonomy.yml")
w = workflow.read_text()
anchor = "      - run: npx -y tsx lib/orion/autonomy/orion-read-evidence.contract.test.ts\n"
line = anchor + "      - run: npx -y tsx lib/orion/autonomy/orion-parallel-safe-reads.contract.test.ts\n"
if anchor not in w:
    raise SystemExit("workflow anchor missing")
workflow.write_text(w.replace(anchor, line, 1))
