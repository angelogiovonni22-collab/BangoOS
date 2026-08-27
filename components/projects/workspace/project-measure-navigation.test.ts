import fs from "node:fs";
import path from "node:path";

describe("project Measure navigation", () => {
  it("registers Measure and routes it to the project-scoped tool", () => {
    const tabs = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-workspace-tabs.ts"), "utf8");
    const nav = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-tabs.tsx"), "utf8");
    expect(tabs).toContain('{ key: "measure"');
    expect(nav).toContain('key === "measure"');
    expect(nav).toContain('router.push(`${pathname}/measure`)');
  });
});
