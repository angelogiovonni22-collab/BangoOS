import { resolveOrionStepReferences, type OrionStepReferenceOutput } from "./step-references";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  + ${message}`); passed += 1; }
  else { console.error(`  x FAIL: ${message}`); failed += 1; }
}

function expectOk(result: ReturnType<typeof resolveOrionStepReferences>) {
  if (!result.ok) throw new Error(result.error);
  return result;
}

function main() {
  const outputs: OrionStepReferenceOutput[] = [{
    index: 1,
    commandId: "project.lookup",
    entityId: "project-123",
    href: "/projects/project-123",
    createdEntityIds: [],
    updatedEntityIds: [],
    details: {
      customer: { id: "customer-7" },
      metrics: { healthScore: 93 },
      projectIds: ["project-123", "project-456"],
    },
  }];

  console.log("\nOrion autonomy step-reference contract");

  const chained = expectOk(resolveOrionStepReferences({
    currentStepIndex: 2,
    outputs,
    params: {
      projectId: "$step.1.entityId",
      customerId: "$step.1.details.customer.id",
      score: "$step.1.details.metrics.healthScore",
      nested: { href: "$step.1.href" },
      ids: ["$step.1.details.projectIds.0", "$step.1.details.projectIds.1"],
      ordinaryText: "project status",
    },
  }));
  const params = chained.value as Record<string, unknown>;
  assert(params.projectId === "project-123", "a later read can consume an earlier entity id");
  assert(params.customerId === "customer-7", "nested verified details can feed a later read");
  assert(params.score === 93, "step references preserve non-string primitive types");
  assert((params.nested as Record<string, unknown>).href === "/projects/project-123", "references resolve recursively inside nested objects");
  assert(Array.isArray(params.ids) && params.ids[1] === "project-456", "references resolve through arrays and array indices");
  assert(params.ordinaryText === "project status", "ordinary parameter strings remain untouched");
  assert(chained.referencesResolved === 6, "resolver reports how many prior-step values were consumed");

  const currentStep = resolveOrionStepReferences({ currentStepIndex: 1, outputs, params: { id: "$step.1.entityId" } });
  assert(!currentStep.ok, "a step cannot reference itself");
  const futureStep = resolveOrionStepReferences({ currentStepIndex: 2, outputs, params: { id: "$step.2.entityId" } });
  assert(!futureStep.ok, "a step cannot reference a future or current step");
  const missingPath = resolveOrionStepReferences({ currentStepIndex: 2, outputs, params: { id: "$step.1.details.missing" } });
  assert(!missingPath.ok, "missing output paths fail closed instead of becoming undefined inputs");
  const malformed = resolveOrionStepReferences({ currentStepIndex: 2, outputs, params: { id: "$step.one.entityId" } });
  assert(!malformed.ok, "malformed step-reference syntax fails closed");
  const prototypePath = resolveOrionStepReferences({ currentStepIndex: 2, outputs, params: { id: "$step.1.details.__proto__" } });
  assert(!prototypePath.ok, "prototype-chain paths are blocked");

  console.log(`\nOrion autonomy step-reference results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
