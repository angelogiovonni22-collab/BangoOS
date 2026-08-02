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

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  console.log(`\n${name}`);
  await fn();
}

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function listRelativeFiles(relativeDir: string): string[] {
  const absoluteDir = path.resolve(process.cwd(), relativeDir);
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRelativeFiles(entryPath));
      continue;
    }

    files.push(entryPath.replaceAll("\\", "/"));
  }

  return files;
}

async function main(): Promise<void> {
  const pageSource = read("app/(app)/labs/quantum/page.tsx");
  const fixtureSource = read("lib/labs/quantum/fixtures.ts");
  const componentFiles = listRelativeFiles("components/labs/quantum");
  const componentSources = componentFiles.map((file) => read(file));
  const allSources = [pageSource, fixtureSource, ...componentSources];

  await test("1. route remains isolated under authenticated shell", () => {
    assert(fs.existsSync(path.resolve(process.cwd(), "app/(app)/labs/quantum/page.tsx")), "quantum route exists under app/(app)");
    assert(!fs.existsSync(path.resolve(process.cwd(), "app/labs/quantum/page.tsx")), "no root-level public labs route was added");
  });

  await test("2. no production service integrations", () => {
    const forbiddenImports = [
      "@/lib/supabase",
      "from(\"profiles\")",
      "useOperationsCommandCenter",
      "@/lib/workforce",
      "@/lib/operations",
      "@/lib/company",
    ];

    for (const forbidden of forbiddenImports) {
      assert(allSources.every((source) => !source.includes(forbidden)), `does not reference ${forbidden}`);
    }
  });

  await test("3. no API calls or write operations", () => {
    const forbiddenOps = ["fetch(", "/api/", ".insert(", ".update(", ".delete(", ".upsert("];

    for (const forbidden of forbiddenOps) {
      assert(allSources.every((source) => !source.includes(forbidden)), `does not include ${forbidden}`);
    }
  });

  await test("4. fixture-only data path", () => {
    assert(pageSource.includes("@/lib/labs/quantum/fixtures"), "page imports local lab fixtures");
    assert(fixtureSource.includes("quantumMetrics"), "fixtures define deterministic metric payloads");
    assert(fixtureSource.includes("quantumTwinNodes"), "fixtures define digital twin placeholder nodes");
  });

  await test("5. explicit isolation notice and reduced-motion integration", () => {
    assert(pageSource.includes("fixture-only data"), "page communicates fixture-only guardrails");
    assert(pageSource.includes("useMotionPreferences"), "page integrates with shared reduced-motion context");
  });

  console.log(`\nQuantum lab isolation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
