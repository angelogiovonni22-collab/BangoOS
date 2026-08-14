import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
    return;
  }

  console.error(`  x FAIL: ${message}`);
  failed += 1;
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

async function main() {
  const source = read("docs/design/bos-design-bible-v1.md");

  await test("1. required major headings exist", () => {
    assert(source.includes("## 1) Product Identity"), "Product Identity heading exists");
    assert(source.includes("## 8) Motion Language"), "Motion Language heading exists");
    assert(source.includes("## 9) Company Pulse Specification"), "Company Pulse heading exists");
    assert(source.includes("## 10) Orion Visual and Communication Specification"), "Orion heading exists");
    assert(source.includes("## 11) Digital Twin Specification"), "Digital Twin heading exists");
    assert(source.includes("## 20) Implementation Rules for Copilot"), "Implementation Rules heading exists");
  });

  await test("2. naming standard is present", () => {
    assert(source.includes("Primary product name: B.O.S."), "B.O.S. primary naming rule exists");
    assert(source.includes("Official subtitle: Bango Operating System"), "official subtitle rule exists");
    assert(source.includes("Prohibited Variations"), "prohibited naming variations section exists");
  });

  await test("3. reduced-motion policy exists", () => {
    assert(source.includes("Reduced-motion support is mandatory."), "core reduced-motion requirement exists");
    assert(source.includes("Reduced-motion fallback"), "motion fallback guidance exists");
  });

  console.log(`\nB.O.S. Design Bible contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
