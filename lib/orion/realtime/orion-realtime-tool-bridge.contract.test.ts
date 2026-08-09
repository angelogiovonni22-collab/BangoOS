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
  const toolRoute = read("app/api/orion/realtime/tool/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const client = read("lib/orion/realtime/client.ts");
  const catalog = read("lib/orion/intelligence/universal-command-catalog.ts");

  console.log("\nOrion Realtime BOS tool bridge contract");

  assert(session.includes("buildUniversalBosToolCatalog()"), "Realtime exposes the canonical BOS command catalog");
  assert(catalog.includes('.filter((command) => command.coverage.status !== "unsupported")'), "unsupported BOS commands are never exposed");
  assert(session.includes('name: CONFIRM_TOOL_NAME') && session.includes('tool_choice: "auto"'), "Realtime includes the controlled confirmation tool and automatic tool selection");
  assert(session.includes('transcription: {') && session.includes('model: "gpt-4o-mini-transcribe"'), "Realtime captures a user transcript for confirmation evidence");
  assert(bridge.includes('event.type !== "response.function_call_arguments.done"'), "tool execution waits for finalized Realtime function-call arguments");
  assert(bridge.includes('type: "function_call_output"') && bridge.includes('type: "response.create"'), "tool results are returned to Realtime and conversation resumes");
  assert(client.includes("executeOrionRealtimeTool(call") && client.includes("activeToolCalls"), "browser bridge executes each finalized tool call once through the BOS endpoint");
  assert(toolRoute.includes("getUniversalBosCommandByToolName"), "Realtime tool names resolve back to canonical BOS commands");
  assert(toolRoute.includes("command.validate(args.params)"), "Realtime BOS calls use canonical validation");
  assert(toolRoute.includes("createOrionCommandRouter({ supabase: args.supabase })"), "Realtime BOS calls use the canonical command router");
  assert(toolRoute.includes('command.confirmationLevel === "REQUIRED"') && toolRoute.includes("confirmationRequired: true"), "required confirmation is gated before execution");
  assert(toolRoute.includes("createHmac") && toolRoute.includes("timingSafeEqual") && toolRoute.includes("CONFIRMATION_TTL_MS"), "pending confirmation uses a signed short-lived token");
  assert(client.includes("extractOrionRealtimeUserTranscript") && client.includes("waitForRecentUserTranscript"), "confirmation execution uses recent user speech rather than model assertion alone");
  assert(toolRoute.includes("isExplicitConfirmation(confirmationTranscript)"), "server requires explicit transcribed user confirmation before gated execution");
  assert(toolRoute.includes("pending.companyId !== workspace.context.companyId") && toolRoute.includes("pending.userId !== workspace.context.userId"), "confirmation tokens are scoped to the authenticated company and user");

  console.log(`\nOrion Realtime BOS tool bridge results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
