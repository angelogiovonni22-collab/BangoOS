import fs from "node:fs";
import path from "node:path";

describe("Measure save gate", () => {
  it("disables save until endpoints and distance exist", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("disabled={!firstPoint || !secondPoint || !value}");
  });
});
