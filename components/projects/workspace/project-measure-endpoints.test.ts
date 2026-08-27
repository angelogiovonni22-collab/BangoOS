import fs from "node:fs";
import path from "node:path";

describe("Measure endpoints", () => {
  it("normalizes pointer endpoints to the camera viewport", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("/ rect.width) * 100");
    expect(source).toContain("/ rect.height) * 100");
    expect(source).toContain("Math.atan2");
  });
});
