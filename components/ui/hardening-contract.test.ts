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

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main(): void {
  const layout = read("app/layout.tsx");
  const aliases = read("app/legacy-token-aliases.css");
  const pageHeader = read("components/ui/page-header.tsx");
  const sectionHeader = read("components/ui/section-header.tsx");
  const input = read("components/ui/input.tsx");
  const table = read("components/ui/enterprise-table.tsx");
  const tableContainer = read("components/ui/table-container.tsx");

  assert(layout.includes('import "./legacy-token-aliases.css";'), "root layout loads legacy token aliases");

  for (const token of [
    "--text-primary",
    "--text-secondary",
    "--text-muted",
    "--surface-default",
    "--surface-raised",
    "--border-subtle",
    "--border-default",
    "--border-strong",
  ]) {
    assert(aliases.includes(`${token}:`), `legacy alias ${token} is defined`);
  }

  assert(pageHeader.includes("var(--color-text-primary)"), "page header title is surface-aware");
  assert(pageHeader.includes("var(--color-text-secondary)"), "page header supporting copy is surface-aware");
  assert(pageHeader.includes("min-w-0"), "page header protects narrow layouts from intrinsic overflow");

  assert(sectionHeader.includes("var(--color-text-primary)"), "section header title is surface-aware");
  assert(sectionHeader.includes("var(--color-text-secondary)"), "section header supporting copy is surface-aware");
  assert(sectionHeader.includes("min-w-0"), "section header protects narrow layouts from intrinsic overflow");

  assert(input.includes("placeholder:text-[var(--color-text-muted)]"), "input placeholder follows surface-aware muted text token");
  assert(input.includes("hover:border-[var(--color-border-strong)]"), "input hover border follows surface-aware border token");

  assert(table.includes("max-w-full overflow-x-auto"), "enterprise table contains horizontal overflow locally");
  assert(table.includes("bg-[var(--bos-bg-control)]"), "enterprise table header uses a dark owned surface with readable heading text");
  assert(tableContainer.includes("text-[var(--bos-text-strong-on-light)]"), "light table container header uses explicit on-light title text");

  console.log(`\nHardening contract results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
