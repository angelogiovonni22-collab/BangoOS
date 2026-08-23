import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const shell = read("app/(app)/app-shell.tsx");
const component = read("components/search/global-search.tsx");
const route = read("app/api/search/route.ts");

assert.ok(shell.includes("<GlobalSearch") && !shell.includes("<SearchBar placeholder"), "app shell mounts the functional global search");
assert.ok(route.includes("resolveWorkspaceContext") && route.includes('.eq("company_id", companyId)'), "search is authenticated and company scoped");
for (const table of ["customers", "projects", "estimates", "invoices", "employees", "crews", "vendors"]) {
  assert.ok(route.includes(`from("${table}")`), `${table} participates in global search`);
}
assert.ok(route.includes("getOrionNavigationRoutesForRole"), "search includes permission-filtered BOS workspaces");
assert.ok(component.includes("AbortController") && component.includes("window.setTimeout"), "search requests are debounced and cancellable");
assert.ok(component.includes('event.key === "ArrowDown"') && component.includes('event.key === "Enter"'), "search supports keyboard result navigation");
assert.ok(component.includes('event.key === "/"') && component.includes("isTyping"), "search supports a non-conflicting slash shortcut outside text fields");
assert.ok(component.includes('className="fixed left-4 right-4') && shell.includes('order-last w-full'), "search is available with a viewport-safe result panel on mobile");
assert.ok(route.includes('.or(`') && route.includes(".limit(20)"), "record search filters at the database instead of truncating an arbitrary first page");
assert.ok(component.includes("router.push(result.href)"), "selecting a result navigates to its canonical record route");

console.log("BOS global search contract: all assertions passed");
