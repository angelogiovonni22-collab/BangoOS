import fs from "node:fs";
import path from "node:path";

describe("project Measure navigation", () => {
  it("registers Measure as a dedicated project tool route", () => {
    const nav = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-tabs.tsx"), "utf8");
    expect(nav).toContain('const MEASURE_TAB_KEY = "measure"');
    expect(nav).toContain('router.push(`${pathname}/measure`)');
    expect(nav).toContain('label: "Measure"');
  });
});
