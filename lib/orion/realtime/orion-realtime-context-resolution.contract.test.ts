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
  const contextRoute = read("app/api/orion/realtime/current-context/route.ts");
  const resolverRoute = read("app/api/orion/realtime/resolve-entity/route.ts");
  const resolver = read("lib/orion/realtime/entity-resolution.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const policy = read("lib/orion/intelligence/orion-tool-router.ts");
  const types = read("lib/orion/realtime/types.ts");

  console.log("\nOrion Realtime context and entity resolution contract");

  assert(session.includes('CONTEXT_TOOL_NAME = "orion_current_context"'), "Realtime exposes live current-page context");
  assert(session.includes('RESOLVE_ENTITY_TOOL_NAME = "orion_resolve_entity"'), "Realtime exposes spoken entity resolution");
  assert(session.includes("Never invent an id"), "Realtime is instructed never to fabricate BOS record ids");
  assert(session.includes("more than one candidate") && session.includes("clarification"), "ambiguous entity matches require conversational clarification");
  assert(session.includes("Conversation-first routing rule"), "Realtime explicitly prioritizes ordinary conversation over BOS tool use");
  assert(session.includes("can you hear me") && session.includes("MUST NOT call a BOS tool"), "capability checks like can-you-hear-me are protected from accidental BOS actions");
  assert(session.includes("Navigation tools require explicit navigation intent"), "Realtime navigation requires explicit user navigation language");
  assert(session.includes("If you are uncertain whether the user wants a BOS action or conversation"), "ambiguous intent clarifies instead of executing a tool");
  assert(bridge.includes("window.location.href"), "current context is resolved from the live browser route without reconnecting Realtime");
  assert(bridge.includes('/api/orion/realtime/current-context'), "Realtime current context is enriched through an authenticated server endpoint");
  assert(bridge.includes('return await currentBosContext()'), "Realtime waits for enriched current context before returning tool output");
  assert(contextRoute.includes("resolveWorkspaceContext"), "Realtime current-context enrichment is authenticated");
  assert(contextRoute.includes('.eq("company_id", workspace.context.companyId)'), "Realtime project context is tenant-scoped");
  assert(contextRoute.includes('.eq("id", projectId)'), "Realtime project context targets the exact live project route");
  assert(contextRoute.includes('product: "orion_voice"'), "Realtime current-project context emits non-settling Orion voice usage telemetry");
  assert(contextRoute.includes("recordBosInternalIntelligenceUsageEvent"), "Realtime context telemetry uses the authenticated internal recorder");
  assert(contextRoute.includes("activeProjectContextLoaded: Boolean(project)"), "Realtime telemetry records whether active project data was actually loaded");
  assert(policy.includes("Current-context rule:"), "Orion policy requires live context before asking which current project the user means");
  assert(policy.includes("do not ask the user to identify the project again"), "Resolved active project details suppress redundant project-name clarification");
  assert(bridge.includes('/api/orion/realtime/resolve-entity'), "spoken entity names are resolved through an authenticated server endpoint");
  assert(resolverRoute.includes("resolveWorkspaceContext") && resolverRoute.includes("resolveOrionEntity"), "entity resolution route is authenticated and delegates to the shared resolver");
  assert(resolver.includes('.eq("company_id", params.companyId)'), "entity candidate queries are company-scoped in the shared resolver");
  assert(resolver.includes('OrionResolvableEntityType = "customer" | "project" | "estimate" | "invoice"'), "entity resolver supports core customer/project/estimate/invoice records");
  assert(types.includes("details?: unknown"), "Realtime function outputs can return structured context and entity details");
  assert(bridge.includes("details: result.details ?? null"), "structured tool details are returned to the Realtime model");

  console.log(`\nOrion Realtime context resolution results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();