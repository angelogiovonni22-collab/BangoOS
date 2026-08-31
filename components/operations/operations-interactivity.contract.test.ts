import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const workforce = read("components/crews/workforce-operations-dashboard.tsx");
const finance = read("components/operations/company-financial-reporting-panel.tsx");

test("operations page removes the duplicate daily reports portal", () => {
  assert.equal(workforce.includes("DailyReportsWorkspace"), false);
  assert.equal(workforce.includes('href="/daily-reports"'), false);
  assert.equal(workforce.includes('href="/daily-reports/new"'), false);
});

test("operations page exposes real navigation targets for primary workspaces", () => {
  for (const href of ["/schedule", "/crews", "/employees", "/equipment"]) {
    assert.equal(workforce.includes(`href="${href}"`), true, `missing ${href} shortcut`);
  }
  assert.equal(workforce.includes("Operations workspace shortcuts"), true);
});

test("calendar controls expose selected state and stay interactive", () => {
  assert.equal(workforce.includes('aria-pressed={calendarView === "day"}'), true);
  assert.equal(workforce.includes('aria-pressed={calendarView === "week"}'), true);
  assert.equal(workforce.includes('aria-pressed={calendarView === "month"}'), true);
});

test("equipment controls no longer present a decorative project dropdown", () => {
  assert.equal(workforce.includes('aria-label="Equipment project"'), false);
  assert.equal(workforce.includes('aria-label="Equipment crew"'), true);
  assert.equal(workforce.includes("Project-level equipment context remains managed in the Equipment module"), true);
});

test("workforce and financial cards provide hover, focus, and navigation affordances", () => {
  assert.equal(workforce.includes("hover:-translate-y-0.5"), true);
  assert.equal(workforce.includes("focus-visible:outline-blue-500"), true);
  assert.equal(finance.includes("hover:-translate-y-0.5"), true);
  assert.equal(finance.includes("focus-visible:outline-blue-500"), true);
  assert.equal(finance.includes('href="/invoices"'), true);
  assert.equal(finance.includes('href="/projects"'), true);
});
