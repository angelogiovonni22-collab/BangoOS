import fs from "node:fs";
import path from "node:path";

describe("B.O.S. Measure Phase 1", () => {
  it("keeps the feature project scoped from navigation through persistence", () => {
    const nav = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-tabs.tsx"), "utf8");
    const route = fs.readFileSync(path.join(process.cwd(), "app/(app)/projects/[id]/measure/page.tsx"), "utf8");
    const measure = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(nav).toContain("/measure");
    expect(route).toContain("projectId={projectId}");
    expect(measure).toContain("bos:measure:${projectId}");
  });
});
