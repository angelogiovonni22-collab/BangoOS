import { createOrionCommandRegistry } from "@/lib/orion/commands";
import {
  buildOrionSystemPolicy,
  buildUniversalBosToolCatalog,
  getUniversalBosCommandByToolName,
  summarizeUniversalBosCoverage,
} from "@/lib/orion/intelligence";

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

function main() {
  const registry = createOrionCommandRegistry();
  const commands = registry.list();
  const tools = buildUniversalBosToolCatalog();
  const coverage = summarizeUniversalBosCoverage();

  console.log("\nOrion universal BOS command catalog contract");

  assert(coverage.total === commands.length, "coverage summary accounts for every registered BOS command");
  assert(tools.length === coverage.executable + coverage.navigationOnly, "every non-unsupported BOS command is exposed to Orion intelligence");
  assert(new Set(tools.map((tool) => tool.name)).size === tools.length, "AI-facing BOS tool names are unique");
  assert(tools.every((tool) => tool.name.startsWith("bos_")), "every AI-facing command is namespaced as a BOS tool");
  assert(tools.every((tool) => getUniversalBosCommandByToolName(tool.name)?.id === tool.metadata.commandId), "every AI-facing tool resolves back to the canonical BOS command registry");
  assert(tools.every((tool) => tool.metadata.coverageStatus !== "unsupported"), "unsupported commands are never exposed as executable AI tools");
  assert(tools.every((tool) => tool.description.includes("Never bypass BOS validation, permissions, or confirmation controls.")), "every tool carries the BOS safety contract");

  const policy = buildOrionSystemPolicy();
  assert(policy.includes("Never claim a BOS action succeeded until the BOS command executor returns success."), "Orion cannot hallucinate successful BOS actions");
  assert(policy.includes("web search"), "Orion policy supports external research without mixing it with BOS execution");
  assert(policy.includes("follow-up question"), "Orion policy requires conversational clarification for missing action details");

  console.log(`\nOrion universal BOS catalog results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
