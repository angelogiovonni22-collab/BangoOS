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

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function listRelativeFiles(relativeDir: string): string[] {
  const absoluteDir = path.resolve(process.cwd(), relativeDir);
  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRelativeFiles(path.relative(process.cwd(), absolutePath).replace(/\\/g, "/")));
      continue;
    }

    files.push(path.relative(process.cwd(), absolutePath).replace(/\\/g, "/"));
  }

  return files;
}

async function main() {
  const routeSource = read("app/(app)/labs/mission-control/page.tsx");
  const cssSource = read("app/(app)/labs/mission-control/mission-control.module.css");
  const fixtureSource = read("lib/labs/mission-control/fixtures.ts");
  const typeSource = read("lib/labs/mission-control/types.ts");
  const pulseSource = read("components/labs/mission-control/CompanyPulsePrime.tsx");
  const orionSource = read("components/labs/mission-control/OrionPriorityRail.tsx");
  const twinSource = read("components/labs/mission-control/MissionDigitalTwin.tsx");
  const timelineSource = read("components/labs/mission-control/MissionTimeline.tsx");
  const actionsSource = read("components/labs/mission-control/PriorityActionQueue.tsx");
  const dashboardSource = read("app/(app)/dashboard/page.tsx");

  const missionFiles = [
    routeSource,
    cssSource,
    fixtureSource,
    typeSource,
    pulseSource,
    orionSource,
    twinSource,
    timelineSource,
    actionsSource,
    ...listRelativeFiles("components/labs/mission-control").map((file) => read(file)),
  ];

  await test("1. mission control route exists", () => {
    assert(routeSource.includes("export default function MissionControlPage"), "Mission Control page route is defined");
    assert(routeSource.includes("mission-control.module.css"), "route uses local Mission Control stylesheet");
  });

  await test("2. fixture-only isolation", () => {
    assert(routeSource.includes("fixture-only data"), "route communicates fixture-only disclaimer");
    assert(routeSource.includes("missionControlScenarios"), "route reads deterministic local fixtures");
  });

  await test("3. no Supabase imports", () => {
    const forbidden = ["@/lib/supabase", "@supabase/", "createClient", "supabase"];
    for (const token of forbidden) {
      if (token === "supabase") {
        assert(missionFiles.every((source) => !source.includes("from \"@/lib/supabase")), "mission files avoid lib/supabase import paths");
      } else {
        assert(missionFiles.every((source) => !source.includes(token)), `mission files avoid ${token}`);
      }
    }
  });

  await test("4. no production service imports", () => {
    const forbiddenImports = ["@/lib/dashboard", "@/lib/operations", "@/lib/workforce", "@/lib/projects", "useOperationsCommandCenter"];
    for (const token of forbiddenImports) {
      assert(missionFiles.every((source) => !source.includes(token)), `mission files avoid ${token}`);
    }
  });

  await test("5. no write behavior", () => {
    const forbiddenOps = [".insert(", ".update(", ".delete(", ".upsert(", "fetch(", "/api/"];
    for (const token of forbiddenOps) {
      assert(missionFiles.every((source) => !source.includes(token)), `mission files avoid ${token}`);
    }
  });

  await test("6. three scenarios exist", () => {
    assert(fixtureSource.includes("normal-operations"), "normal operations scenario exists");
    assert(fixtureSource.includes("weather-risk"), "weather risk scenario exists");
    assert(fixtureSource.includes("labor-shortage"), "labor shortage scenario exists");
  });

  await test("7. Company Pulse includes freshness and completeness", () => {
    assert(pulseSource.includes("Freshness:"), "Company Pulse renders freshness label");
    assert(pulseSource.includes("Completeness:"), "Company Pulse renders completeness label");
    assert(typeSource.includes("completenessPercent"), "Company state schema includes completeness percent");
  });

  await test("8. Orion distinguishes fact prediction recommendation", () => {
    assert(typeSource.includes('OrionPriorityKind = "fact" | "prediction" | "recommendation"'), "Orion type includes fact/prediction/recommendation labels");
    assert(orionSource.includes("priority.kind"), "Orion UI renders kind label");
  });

  await test("9. Orion includes limitations and approval boundary", () => {
    assert(orionSource.includes("Limitation"), "Orion rail renders limitation field");
    assert(orionSource.includes("Approval boundary"), "Orion rail renders approval boundary field");
    assert(fixtureSource.includes("approvalBoundary"), "Orion fixtures include approval boundary data");
  });

  await test("10. Digital Twin nodes are keyboard accessible", () => {
    assert(twinSource.includes("aria-label={`Focus node ${node.label}."), "Digital Twin node has semantic label");
    assert(twinSource.includes("aria-pressed={isSelected}"), "Digital Twin node exposes selected state");
    assert(twinSource.includes("event.key === \"Enter\" || event.key === \" \""), "Digital Twin node supports Enter and Space");
  });

  await test("11. selected node details are deterministic", () => {
    assert(twinSource.includes("selectedConnections"), "selected node connected links are computed");
    assert(twinSource.includes("Connected links:"), "selected node detail includes connected link count");
    assert(twinSource.includes("Selected focus"), "selected node summary is present");
  });

  await test("12. stale and unknown states are distinct", () => {
    assert(typeSource.includes('"stale" | "unknown"'), "freshness type includes stale and unknown");
    assert(typeSource.includes('"unknown"') && typeSource.includes('"stale"'), "severity type includes unknown and stale semantics");
    assert(fixtureSource.includes('status: "stale"') || fixtureSource.includes('freshness: "stale"'), "fixture includes stale state");
    assert(fixtureSource.includes('status: "unknown"') || fixtureSource.includes('freshness: "unknown"'), "fixture includes unknown state");
  });

  await test("13. timeline events include source and evidence context", () => {
    assert(typeSource.includes("source: string"), "timeline event schema includes source");
    assert(timelineSource.includes("Source:"), "timeline UI renders source label");
    assert(fixtureSource.includes("type: \"orion-evidence-update\""), "timeline fixtures include Orion evidence update event");
  });

  await test("14. priority actions remain advisory", () => {
    assert(actionsSource.includes("Read-only advisory actions"), "action queue labels advisory behavior");
    assert(actionsSource.includes("Prototype advisory only"), "action cards show prototype-only label");
    assert(actionsSource.includes("disabled"), "action preview controls are disabled");
  });

  await test("15. reduced-motion support remains integrated", () => {
    assert(routeSource.includes("useMotionPreferences"), "route reads shared motion preference");
    assert(routeSource.includes("reducedMotion"), "route passes reduced-motion signal to subcomponents");
  });

  await test("16. local token isolation", () => {
    assert(routeSource.includes("mission-control.module.css"), "route uses local mission-control CSS module");
    assert(cssSource.includes(".root"), "local stylesheet defines namespaced root");
    assert(cssSource.includes(".gridGlow"), "local stylesheet defines local visual background layer");
  });

  await test("17. production dashboard remains untouched by mission imports", () => {
    assert(!routeSource.includes("@/components/dashboard"), "Mission route does not import production dashboard components");
    assert(!routeSource.includes("@/lib/dashboard"), "Mission route does not import production dashboard services");
    assert(dashboardSource.includes("export default"), "dashboard page source still exists and is readable");
  });

  console.log(`\nMission Control pilot test results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
