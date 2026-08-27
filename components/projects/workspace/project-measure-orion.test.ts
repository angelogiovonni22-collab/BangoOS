import fs from "node:fs";
import path from "node:path";

describe("Measure Orion semantics", () => {
  it("identifies the workspace and navigation action semantically", () => {
    const measure = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    const tabs = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-tabs.tsx"), "utf8");
    expect(measure).toContain('data-orion-role="project measurement workspace"');
    expect(tabs).toContain("data-orion-action={`workspace-tab-${item.key}`}");
  });
});
