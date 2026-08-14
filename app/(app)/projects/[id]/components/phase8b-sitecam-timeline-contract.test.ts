import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function main() {
  const source = readFileSync(join(process.cwd(), "app", "(app)", "projects", "[id]", "components", "sitecam-workspace.tsx"), "utf8");

  test("1. Orion publisher wiring", () => {
    check(source.includes("createSupabaseOrionEventPublisher"), "sitecam workspace imports Orion event publisher");
    check(source.includes("const orionPublisher = createSupabaseOrionEventPublisher(supabase);"), "sitecam workspace initializes Orion publisher");
  });

  test("2. Upload events", () => {
    check(source.includes("event_type: \"document.uploaded\""), "upload flow publishes document.uploaded");
    check(source.includes("aggregate_type: \"document\""), "upload event uses document aggregate type");
    check(source.includes("project_id: projectId"), "upload event includes project_id in payload");
  });

  test("3. Delete events", () => {
    check(source.includes("event_type: \"document.deleted\""), "delete flow publishes document.deleted");
    check(source.includes("idempotency_key: `project-photo:${deletingPhoto.id}:deleted`"), "delete event has deterministic idempotency key");
  });

  console.log(`\nPhase 8B SiteCam timeline contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
