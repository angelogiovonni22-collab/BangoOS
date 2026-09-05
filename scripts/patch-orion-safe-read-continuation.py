from pathlib import Path

executor_path = Path("lib/orion/autonomy/safe-read-executor.ts")
executor = executor_path.read_text()
executor = executor.replace(
'''  error?: string;
};''',
'''  error?: string;
  continuation?: { nextZeroIndex: number; outputs: OrionStepReferenceOutput[] } | null;
};''',
1,
)
executor = executor.replace(
'''  executionId?: string;
}): Promise<OrionSafeReadExecutionResult> {''',
'''  executionId?: string;
  resume?: { nextZeroIndex: number; outputs: OrionStepReferenceOutput[] } | null;
}): Promise<OrionSafeReadExecutionResult> {''',
1,
)
executor = executor.replace(
'''  const registry = createOrionCommandRegistry();
  const router = createOrionCommandRouter({ supabase: args.supabase });
  const executed: OrionSafeReadExecutionStep[] = [];
  const outputs: OrionStepReferenceOutput[] = [];
  const sequenceStartedAt = Date.now();''',
'''  if (args.resume && (!Number.isInteger(args.resume.nextZeroIndex) || args.resume.nextZeroIndex < 0 || args.resume.nextZeroIndex > planned.plan.autonomousPrefixLength)) {
    return emptyResult({ ok: false, executed: [], stoppedAt: 0, stopReason: "validation_failed", nextBlockedStep: null, error: "Orion continuation state is invalid." });
  }

  const registry = createOrionCommandRegistry();
  const router = createOrionCommandRouter({ supabase: args.supabase });
  const executed: OrionSafeReadExecutionStep[] = [];
  const outputs: OrionStepReferenceOutput[] = [...(args.resume?.outputs ?? [])];
  const sequenceStartedAt = Date.now();''',
1,
)
executor = executor.replace(
'''  let zeroIndex = 0;
  while (zeroIndex < planned.plan.autonomousPrefixLength) {''',
'''  let zeroIndex = args.resume?.nextZeroIndex ?? 0;
  while (zeroIndex < planned.plan.autonomousPrefixLength) {''',
1,
)
executor = executor.replace(
'''        nextBlockedStep: planned.plan.steps[zeroIndex] ?? null,
        nextBlockedAction: null,
      };''',
'''        nextBlockedStep: planned.plan.steps[zeroIndex] ?? null,
        nextBlockedAction: null,
        continuation: { nextZeroIndex: zeroIndex, outputs: [...outputs] },
      };''',
1,
)
executor_path.write_text(executor)

route_path = Path("app/api/orion/autonomy/execute-safe-read/route.ts")
route = route_path.read_text()
route = route.replace(
'''import type { OrionAutonomyPlanRequestStep } from "@/lib/orion/autonomy/plan-request";''',
'''import type { OrionAutonomyPlanRequestStep } from "@/lib/orion/autonomy/plan-request";
import { decodeOrionSafeReadContinuation, encodeOrionSafeReadContinuation } from "@/lib/orion/autonomy/continuation-token";''',
1,
)
old_body = '''    const body = await req.json() as { steps?: unknown; executionId?: unknown };
    if (!Array.isArray(body.steps)) {
      return NextResponse.json({ ok: false, error: "A BOS step list is required." }, { status: 400 });
    }

    const executionId = typeof body.executionId === "string" && body.executionId.trim()
      ? body.executionId.trim()
      : undefined;

    const sequenceStartedAt = Date.now();
    const result = await executeOrionSafeReadPrefix({
      steps: body.steps as OrionAutonomyPlanRequestStep[],
      supabase,
      companyId: workspace.context.companyId,
      userId: workspace.context.userId,
      role: workspace.context.role,
      executionId,
    });
'''
new_body = '''    const body = await req.json() as { steps?: unknown; executionId?: unknown; continuationToken?: unknown };
    const rawContinuationToken = typeof body.continuationToken === "string" ? body.continuationToken.trim() : "";
    const continuation = rawContinuationToken ? decodeOrionSafeReadContinuation(rawContinuationToken) : null;
    if (rawContinuationToken && !continuation) {
      return NextResponse.json({ ok: false, error: "Orion continuation token is invalid or expired." }, { status: 400 });
    }
    if (continuation && (continuation.companyId !== workspace.context.companyId || continuation.userId !== workspace.context.userId)) {
      return NextResponse.json({ ok: false, error: "Orion continuation token does not belong to this workspace session." }, { status: 403 });
    }
    if (!continuation && !Array.isArray(body.steps)) {
      return NextResponse.json({ ok: false, error: "A BOS step list or continuation token is required." }, { status: 400 });
    }

    const steps = continuation?.steps ?? body.steps as OrionAutonomyPlanRequestStep[];
    const executionId = continuation?.executionId ?? (typeof body.executionId === "string" && body.executionId.trim()
      ? body.executionId.trim()
      : undefined);

    const sequenceStartedAt = Date.now();
    const result = await executeOrionSafeReadPrefix({
      steps,
      supabase,
      companyId: workspace.context.companyId,
      userId: workspace.context.userId,
      role: workspace.context.role,
      executionId,
      resume: continuation ? { nextZeroIndex: continuation.nextZeroIndex, outputs: continuation.outputs } : null,
    });
'''
if old_body not in route:
    raise SystemExit("route request anchor missing")
route = route.replace(old_body, new_body, 1)
old_response = '''    const response = NextResponse.json({
      ...result,
      telemetry: {
        durationMs,
        executedSteps: result.executed.length,
        retries,
        slowestStepMs,
      },
    }, { status: result.ok ? 200 : 400 });'''
new_response = '''    const continuationToken = result.stopReason === "time_budget_exceeded" && result.continuation && executionId
      ? encodeOrionSafeReadContinuation({
          companyId: workspace.context.companyId,
          userId: workspace.context.userId,
          executionId,
          steps,
          outputs: result.continuation.outputs,
          nextZeroIndex: result.continuation.nextZeroIndex,
        })
      : null;
    const { continuation: _continuation, ...publicResult } = result;
    const response = NextResponse.json({
      ...publicResult,
      continuationToken,
      continuationAvailable: Boolean(continuationToken),
      telemetry: {
        durationMs,
        executedSteps: result.executed.length,
        retries,
        slowestStepMs,
      },
    }, { status: result.ok ? 200 : 400 });'''
if old_response not in route:
    raise SystemExit("route response anchor missing")
route = route.replace(old_response, new_response, 1)
route_path.write_text(route)

bridge_path = Path("lib/orion/realtime/tool-bridge.ts")
bridge = bridge_path.read_text()
bridge = bridge.replace(
'''  const steps = Array.isArray(call.params.steps) ? call.params.steps : [];
  const requestedExecutionId = typeof call.params.executionId === "string" && call.params.executionId.trim() ? call.params.executionId.trim() : call.callId;''',
'''  const steps = Array.isArray(call.params.steps) ? call.params.steps : [];
  const continuationToken = typeof call.params.continuationToken === "string" && call.params.continuationToken.trim() ? call.params.continuationToken.trim() : null;
  const requestedExecutionId = typeof call.params.executionId === "string" && call.params.executionId.trim() ? call.params.executionId.trim() : call.callId;''',
1,
)
bridge = bridge.replace(
'''    body: JSON.stringify({ steps, executionId: requestedExecutionId }),''',
'''    body: JSON.stringify({ steps, executionId: requestedExecutionId, continuationToken }),''',
1,
)
bridge = bridge.replace(
'''    telemetry?: unknown;
  };
  const ok = Boolean(response.ok && payload.ok);
  return {
    ok,
    statusCategory: ok ? "autonomy_read_sequence_completed" : "autonomy_read_sequence_failed",''',
'''    telemetry?: unknown;
    continuationToken?: unknown;
    continuationAvailable?: unknown;
  };
  const ok = Boolean(response.ok && payload.ok);
  const paused = ok && payload.stopReason === "time_budget_exceeded" && typeof payload.continuationToken === "string";
  return {
    ok,
    statusCategory: paused ? "autonomy_read_sequence_paused" : (ok ? "autonomy_read_sequence_completed" : "autonomy_read_sequence_failed"),''',
1,
)
bridge = bridge.replace(
'''      telemetry: payload.telemetry ?? null,
    },''',
'''      telemetry: payload.telemetry ?? null,
      continuationToken: typeof payload.continuationToken === "string" ? payload.continuationToken : null,
      continuationAvailable: Boolean(payload.continuationAvailable),
    },''',
1,
)
bridge_path.write_text(bridge)

session_path = Path("app/api/orion/realtime/session/route.ts")
session = session_path.read_text()
session = session.replace(
'''        executionId: { type: "string", description: "Optional stable identifier for retry-safe sequence execution." },
      }, ["steps"]),''',
'''        executionId: { type: "string", description: "Optional stable identifier for retry-safe sequence execution." },
        continuationToken: { type: "string", description: "Encrypted short-lived continuation token returned after a safe sequence reaches its server time budget. When this is supplied, omit steps and executionId; BOS restores the verified prior outputs server-side." },
      }),''',
1,
)
instruction_anchor = '        "Read-chain policy: when a later read depends on the verified result of an earlier read in the same safe sequence, use an exact $step.N output reference instead of guessing or inventing an id. Only reference an earlier step, and use the reference as the entire parameter value so BOS can preserve the original value type.",'
continuation_instruction = '        `Continuation policy: if ${AUTONOMY_SAFE_READ_TOOL_NAME} returns stopReason=time_budget_exceeded with continuationAvailable=true, immediately resume the same safe-read task by calling ${AUTONOMY_SAFE_READ_TOOL_NAME} again with only the returned continuationToken. Never reconstruct, decode, edit, or guess the prior step outputs; BOS restores them from the encrypted token and re-authorizes subsequent reads.`, '
if continuation_instruction.strip() not in session:
    if instruction_anchor not in session:
        raise SystemExit("session instruction anchor missing")
    session = session.replace(instruction_anchor, instruction_anchor + "\n" + continuation_instruction, 1)
session_path.write_text(session)

contract_path = Path("lib/orion/autonomy/orion-safe-read-continuation.contract.test.ts")
contract_path.write_text('''import fs from "node:fs";\nimport path from "node:path";\n\nlet passed = 0;\nlet failed = 0;\nfunction assert(condition: boolean, message: string) {\n  if (condition) { console.log(`  + ${message}`); passed += 1; }\n  else { console.error(`  x FAIL: ${message}`); failed += 1; }\n}\nfunction read(relativePath: string) { return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8"); }\n\nfunction main() {\n  const token = read("lib/orion/autonomy/continuation-token.ts");\n  const executor = read("lib/orion/autonomy/safe-read-executor.ts");\n  const route = read("app/api/orion/autonomy/execute-safe-read/route.ts");\n  const bridge = read("lib/orion/realtime/tool-bridge.ts");\n  const session = read("app/api/orion/realtime/session/route.ts");\n\n  console.log("\\nOrion safe-read continuation contract");\n  assert(token.includes('createCipheriv("aes-256-gcm"') && token.includes('createDecipheriv("aes-256-gcm"'), "continuation state is encrypted and authenticated");\n  assert(token.includes("ORION_CONFIRMATION_SECRET") && token.includes("CONTINUATION_TTL_MS = 120_000"), "continuation tokens reuse the server secret and expire quickly");\n  assert(executor.includes("resume?: { nextZeroIndex: number; outputs: OrionStepReferenceOutput[] }"), "executor can resume with server-restored verified outputs");\n  assert(executor.includes("const outputs: OrionStepReferenceOutput[] = [...(args.resume?.outputs ?? [])]"), "resumed reads preserve prior step-reference context");\n  assert(executor.includes("continuation: { nextZeroIndex: zeroIndex, outputs: [...outputs] }"), "time-budget boundary captures continuation state without starting more work");\n  assert(route.includes("decodeOrionSafeReadContinuation") && route.includes("encodeOrionSafeReadContinuation"), "API exclusively encodes and decodes continuation state server-side");\n  assert(route.includes("continuation.companyId !== workspace.context.companyId") && route.includes("continuation.userId !== workspace.context.userId"), "continuations are bound to the active tenant and user");\n  assert(route.includes("const { continuation: _continuation, ...publicResult } = result"), "raw prior outputs are never returned in the JSON response");\n  assert(bridge.includes('statusCategory: paused ? "autonomy_read_sequence_paused"'), "Realtime receives an explicit resumable pause state");\n  assert(session.includes("Continuation policy:") && session.includes("with only the returned continuationToken"), "Realtime is instructed to resume from the encrypted continuation token");\n\n  console.log(`\\nOrion safe-read continuation results: ${passed} passed, ${failed} failed`);\n  if (failed > 0) process.exitCode = 1;\n}\n\nmain();\n''')

workflow_path = Path(".github/workflows/orion-autonomy.yml")
workflow = workflow_path.read_text()
anchor = "      - run: npx -y tsx lib/orion/autonomy/orion-safe-read-time-budget.contract.test.ts\n"
line = anchor + "      - run: npx -y tsx lib/orion/autonomy/orion-safe-read-continuation.contract.test.ts\n"
if anchor not in workflow:
    raise SystemExit("workflow anchor missing")
workflow_path.write_text(workflow.replace(anchor, line, 1))
