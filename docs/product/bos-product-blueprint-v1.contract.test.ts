import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
    return;
  }

  failed += 1;
  console.error(`  x FAIL: ${message}`);
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main() {
  const source = read("docs/product/BOS-PRODUCT-BLUEPRINT.md");

  await test("1. title and product identity header", () => {
    assert(source.includes("# B.O.S. Product Blueprint"), "title is present");
    assert(source.includes("**Version:** 1.0 Working Draft"), "version header is present");
    assert(source.includes("**Product:** B.O.S. - Bango Operating System"), "product header is present");
    assert(source.includes("**Official Definition:** The operating system that runs construction companies."), "official definition header is present");
  });

  await test("2. required major sections", () => {
    const requiredHeadings = [
      "# 1. Why B.O.S. Exists",
      "# 2. Product Identity",
      "# 3. Product Promise",
      "# 4. Primary User Architecture",
      "# 5. Role-Based Operations Overview",
      "# 6. Core Product Modules",
      "# 7. Orion",
      "# 8. Orion Intelligence Architecture",
      "# 9. Company Pulse",
      "# 10. Financial Operating System",
      "# 11. Security Architecture",
      "# 12. Digital Twin",
      "# 13. Mobile and Field Experience",
      "# 14. Integration Strategy",
      "# 15. Product Principles",
      "# 16. Product Roadmap Framework",
      "# 17. Success Definition",
      "# 18. Relationship to the BOS-HIG",
      "# 19. Open Product Decisions",
    ];

    for (const heading of requiredHeadings) {
      assert(source.includes(heading), `heading exists: ${heading}`);
    }
  });

  await test("3. permanent product standards", () => {
    assert(source.includes("One company. One operating system. Complete operational clarity."), "company promise is present");
    assert(source.includes("Every screen must have a clearly defined primary user."), "primary user rule is present");
    assert(source.includes("Orion is the living operational intelligence of B.O.S."), "Orion definition is present");
    assert(source.includes("Observe everything. Explain clearly. Recommend wisely. Never overwhelm."), "Orion mission is present");
    assert(source.includes("Unknown or stale data must never appear healthy by default."), "data honesty rule is present");
  });

  await test("4. architecture and governance anchors", () => {
    assert(source.includes("Business Data"), "Orion stack includes Business Data");
    assert(source.includes("User Review and Approval"), "Orion stack includes user review and approval");
    assert(source.includes("No document should silently override another."), "document override rule is present");
    assert(source.includes("Conflicts must be reviewed and resolved explicitly."), "conflict resolution rule is present");
  });

  console.log(`\nB.O.S. Product Blueprint contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
