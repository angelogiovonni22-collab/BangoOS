import fs from "node:fs";
import path from "node:path";

describe("project Measure route", () => {
  it("renders the project-scoped Measure workspace with a project return path", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/(app)/projects/[id]/measure/page.tsx"), "utf8");
    expect(source).toContain("ProjectMeasureWorkspace");
    expect(source).toContain("projectId={projectId}");
    expect(source).toContain("`/projects/${projectId}`");
  });
});
