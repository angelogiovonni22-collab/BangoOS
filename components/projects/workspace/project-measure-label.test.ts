import fs from "node:fs";
import path from "node:path";

describe("Measure labels", () => {
  it("provides a safe default label", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain('label.trim() || "Measurement"');
  });
});
