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

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const session = read("app/api/orion/realtime/session/route.ts");
  const resolver = read("app/api/orion/realtime/resolve-entity/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const types = read("lib/orion/realtime/types.ts");

  console.log("\nOrion Realtime context and entity resolution contract");

  assert(session.includes('CONTEXT_TOOL_NAME = "orion_current_context"'), "Realtime exposes live current-page context");
  assert(session.includes('RESOLVE_ENTITY_TOOL_NAME = "orion_resolve_entity"'), "Realtime exposes spoken entity resolution");
  assert(session.includes("Never invent an id"), "Realtime is instructed never to fabricate BOS record ids");
  assert(session.includes("more than one candidate") && session.includes("clarification"), "ambiguous entity matches require conversational clarification");
  assert(bridge.includes("window.location.href"), "current context is resolved from the live browser route without reconnecting Realtime");
  assert(bridge.includes('routeEntityId(pathname, "projects")'), "current project id can be inferred from Project Workspace routes");
  assert(bridge.includes('/api/orion/realtime/resolve-entity'), "spoken entity names are resolved through an authenticated server endpoint");
  assert(resolver.includes("resolveWorkspaceContext"), "entity resolution is scoped to the authenticated BOS workspace");
  assert(resolver.includes('.eq("company_id", companyId)'), "entity candidate queries are company-scoped");
  assert(resolver.includes('"customer", "project", "estimate", "invoice"'), "entity resolver supports core customer/project/estimate/invoice records");
  assert(types.includes("details?: unknown"), "Realtime function outputs can return structured context and entity details");
  assert(bridge.includes("details: result.details ?? null"), "structured tool details are returned to the Realtime model");

  console.log(`\nOrion Realtime context resolution results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
