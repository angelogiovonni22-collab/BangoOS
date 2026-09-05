import { buildOrionAutonomyPlan, canAdvanceOrionAutonomyPlan } from "./planner";
import { ORION_MAX_AUTONOMOUS_STEPS } from "./policy";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  + ${message}`); passed += 1; }
  else { console.error(`  x FAIL: ${message}`); failed += 1; }
}

function command(id: string, confirmationLevel: "NONE" | "REVIEW" | "REQUIRED" = "NONE", undoCapable = true) {
  return {
    id,
    confirmationLevel,
    undoCapable,
    coverage: { status: "implemented" as const },
  };
}

function main() {
  console.log("\nOrion autonomy planner contract");

  const safe = buildOrionAutonomyPlan([
    { command: command("project.open") },
    { command: command("estimate.open") },
  ]);
  assert(safe.autonomousPrefixLength === 2, "safe read sequence remains fully autonomous");
  assert(!safe.requiresUserInteraction, "fully autonomous read plan needs no user interaction");

  const confirmed = buildOrionAutonomyPlan([
    { command: command("project.open") },
    { command: command("invoice.send") },
    { command: command("estimate.open") },
  ]);
  assert(confirmed.autonomousPrefixLength === 1, "planner stops autonomous execution at first protected action");
  assert(confirmed.nextBlockedStep?.commandId === "invoice.send", "external-effect step is surfaced as the next blocker");
  assert(confirmed.nextBlockedStep?.stopReason === "confirmation_required", "external-effect step requires confirmation");

  const review = buildOrionAutonomyPlan([
    { command: command("project.open") },
    { command: command("project.update", "REVIEW") },
  ]);
  assert(review.nextBlockedStep?.stopReason === "review_required", "review actions stop unattended sequencing");

  const tooLong = buildOrionAutonomyPlan(Array.from({ length: ORION_MAX_AUTONOMOUS_STEPS + 1 }, (_, index) => ({
    command: command(`resource${index}.open`),
  })));
  assert(tooLong.autonomousPrefixLength === ORION_MAX_AUTONOMOUS_STEPS, "autonomy plan respects maximum unattended step count");
  assert(tooLong.nextBlockedStep?.stopReason === "step_limit", "step-limit overflow is explicitly surfaced");

  assert(canAdvanceOrionAutonomyPlan({ plan: safe, completedSteps: 1, lastResultOk: true, lastResultVerified: true }), "verified success can advance to the next autonomous step");
  assert(!canAdvanceOrionAutonomyPlan({ plan: safe, completedSteps: 1, lastResultOk: false, lastResultVerified: true }), "failed execution stops the sequence");
  assert(!canAdvanceOrionAutonomyPlan({ plan: safe, completedSteps: 1, lastResultOk: true, lastResultVerified: false }), "failed verification stops the sequence");
  assert(!canAdvanceOrionAutonomyPlan({ plan: confirmed, completedSteps: 1, lastResultOk: true, lastResultVerified: true }), "planner never auto-advances into a confirmation-gated action");

  console.log(`\nOrion autonomy planner results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
