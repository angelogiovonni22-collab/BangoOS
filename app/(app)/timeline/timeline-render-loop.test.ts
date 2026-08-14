import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

function main(): void {
  const source = fs.readFileSync(path.resolve(process.cwd(), "app", "(app)", "timeline", "page.tsx"), "utf8");

  assert(source.includes('loadTimeline("append", nextCursor)'), "load-more passes the current cursor explicitly");
  assert(source.includes('cursor: mode === "append" ? cursor || undefined : undefined'), "timeline request uses the explicit append cursor argument");
  assert(!source.includes("[filters.category, filters.searchText, filters.severity, nextCursor"), "nextCursor is not a loadTimeline callback dependency");
  assert(source.includes("[filters.category, filters.searchText, filters.severity, supabase, t]"), "loadTimeline dependencies stay limited to actual replace-query inputs");
  assert(source.includes('void loadTimeline("replace")'), "effect performs a replace load without coupling to cursor state");

  console.log(`\nTimeline render-loop regression results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
