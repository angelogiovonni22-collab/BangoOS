import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Test = {
  name: string;
  run: () => void;
};

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

const tests: Test[] = [
  {
    name: "1. scheduling hook creates one stable service instance",
    run: () => {
      const source = read("lib/scheduling/use-scheduling.ts");
      assert.ok(!source.includes("service = createSchedulingService()"));
      assert.ok(source.includes("const schedulingService = useMemo(() => service ?? createSchedulingService(), [service]);"));
      assert.ok(source.includes("[schedulingService]"));
    },
  },
  {
    name: "2. refresh effect stays keyed only to refresh",
    run: () => {
      const source = read("lib/scheduling/use-scheduling.ts");
      assert.ok(source.includes("useEffect(() => {"));
      assert.ok(source.includes("}, [refresh]);"));
    },
  },
  {
    name: "3. scheduling dashboard consumes the hook once",
    run: () => {
      const source = read("components/scheduling/scheduling-dashboard.tsx");
      assert.ok(source.includes("const scheduling = useScheduling();"));
    },
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test.run();
    console.log(`+ ${test.name}`);
    passed += 1;
  } catch (error) {
    failed += 1;
    console.error(`x ${test.name}`);
    console.error(error);
  }
}

console.log(`\nScheduling render-fetch loop tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exitCode = 1;
}