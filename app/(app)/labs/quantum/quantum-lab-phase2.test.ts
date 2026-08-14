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
  const companyPulseSource = read("components/labs/quantum/CompanyPulse.tsx");
  const orionSource = read("components/labs/quantum/QuantumInsightCard.tsx");
  const twinSource = read("components/labs/quantum/QuantumDigitalTwinPlaceholder.tsx");
  const fixtureSource = read("lib/labs/quantum/fixtures.ts");
  const typeSource = read("lib/labs/quantum/types.ts");

  const componentFiles = listRelativeFiles("components/labs/quantum");
  const allSources = [
    pageSource,
    companyPulseSource,
    orionSource,
    twinSource,
    fixtureSource,
    typeSource,
    ...componentFiles.map((file) => read(file)),
  ];

  await test("1. primary hierarchy emphasizes company state first", () => {
    const heroIndex = pageSource.indexOf("<QuantumHero");
    const pulseIndex = pageSource.indexOf("<CompanyPulse");
    const twinIndex = pageSource.indexOf("<QuantumDigitalTwinPlaceholder");
    const orionIndex = pageSource.indexOf("<QuantumOrionPriority");
    const metricIndex = pageSource.indexOf("<QuantumMetricStrip");

    assert(heroIndex >= 0, "QuantumHero is present");
    assert(pulseIndex > heroIndex, "CompanyPulse appears after executive hero");
    assert(twinIndex > pulseIndex, "Digital Twin appears after Company Pulse");
    assert(orionIndex > pulseIndex, "Orion section appears after Company Pulse");
    assert(metricIndex > twinIndex, "Supporting metrics are visually secondary");
  });

  await test("2. company pulse includes freshness and explicit limits", () => {
    assert(companyPulseSource.includes("healthScore"), "Company Pulse renders health score");
    assert(companyPulseSource.includes("Freshness:"), "Company Pulse renders freshness state");
    assert(companyPulseSource.includes("Known Limits in This Fixture Snapshot"), "Company Pulse renders unknown/stale handling section");
    assert(fixtureSource.includes("quantumCompanyState"), "fixtures define executive company state data");
  });

  await test("3. Orion includes evidence quality and limitations", () => {
    assert(orionSource.includes("Evidence Quality"), "Orion view includes evidence quality");
    assert(orionSource.includes("Limitations / Missing Data"), "Orion view includes limitations");
    assert(fixtureSource.includes("limitations:"), "Orion fixtures include limitations data");
  });

  await test("4. Digital Twin nodes are keyboard accessible", () => {
    assert(twinSource.includes("aria-label={`Focus node ${node.label}`}"), "node controls have meaningful labels");
    assert(twinSource.includes("aria-pressed={isSelected}"), "node controls expose selected state");
    assert(twinSource.includes("onKeyDown"), "node controls handle keyboard activation");
    assert(twinSource.includes("event.key === \"Enter\" || event.key === \" \""), "node controls support Enter and Space");
    assert(twinSource.includes("Selected focus:"), "selected node summary is rendered deterministically");
  });

  await test("5. reduced-motion support remains present", () => {
    assert(pageSource.includes("useMotionPreferences"), "page reads reduced-motion preference from shared provider");
    assert(companyPulseSource.includes("reducedMotion"), "Company Pulse accepts reduced-motion flag");
    assert(orionSource.includes("reducedMotion"), "Orion priority respects reduced-motion flag");
  });

  await test("6. fixture-only isolation and no writes remain enforced", () => {
    const forbiddenImports = ["@/lib/supabase", "@/lib/operations", "@/lib/workforce", "useOperationsCommandCenter"];
    const forbiddenOps = ["fetch(", "/api/", ".insert(", ".update(", ".delete(", ".upsert("];

    for (const forbidden of forbiddenImports) {
      assert(allSources.every((source) => !source.includes(forbidden)), `does not reference ${forbidden}`);
    }

    for (const forbidden of forbiddenOps) {
      assert(allSources.every((source) => !source.includes(forbidden)), `does not include ${forbidden}`);
    }
  });

  await test("7. type contracts support phase 2 semantics", () => {
    assert(typeSource.includes("QuantumFreshness"), "freshness type exists");
    assert(typeSource.includes("QuantumCompanyState"), "company state type exists");
    assert(typeSource.includes("QuantumPulseDimension"), "pulse dimension type exists");
  });

  console.log(`\nQuantum lab phase 2 results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
