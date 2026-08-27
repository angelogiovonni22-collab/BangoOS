import fs from "node:fs";
import path from "node:path";

describe("Measure camera permission", () => {
  it("shows actionable guidance after camera failure", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("Camera access is required");
    expect(source).toContain("browser settings");
  });
});
