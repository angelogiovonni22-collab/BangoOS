import fs from "node:fs";
import path from "node:path";

describe("Measure project scope", () => {
  it("requires a project id", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("type Props = { projectId: string; projectName: string }");
  });
});
