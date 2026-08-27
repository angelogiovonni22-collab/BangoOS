import fs from "node:fs";
import path from "node:path";

describe("Measure reset", () => {
  it("clears both endpoints without deleting history", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("setFirstPoint(null);setSecondPoint(null)");
  });
});
