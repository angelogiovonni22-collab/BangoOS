import fs from "node:fs";
import path from "node:path";

describe("Measure accessibility", () => {
  it("labels measurement inputs and errors", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain('aria-label="Measurement label"');
    expect(source).toContain('aria-label="Measured distance"');
    expect(source).toContain('role="alert"');
  });
});
