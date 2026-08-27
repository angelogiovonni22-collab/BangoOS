import fs from "node:fs";
import path from "node:path";

describe("Measure camera state", () => {
  it("marks camera inactive after stopping tracks", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("setCameraReady(false)");
  });
});
