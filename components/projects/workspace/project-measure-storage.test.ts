import fs from "node:fs";
import path from "node:path";

describe("Measure storage isolation", () => {
  it("uses the current project id in both reads and writes", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source.match(/bos:measure:\$\{projectId\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
