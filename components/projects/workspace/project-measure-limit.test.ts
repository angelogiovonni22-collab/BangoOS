import fs from "node:fs";
import path from "node:path";

describe("Measure history limit", () => {
  it("bounds device-local history", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain(".slice(0, 100)");
  });
});
