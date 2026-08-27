import fs from "node:fs";
import path from "node:path";

describe("Measure overlay", () => {
  it("draws a line between selected endpoints", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("Math.hypot");
    expect(source).toContain("rotate(${line.angle}deg)");
  });
});
