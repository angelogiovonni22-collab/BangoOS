import fs from "node:fs";
import path from "node:path";

describe("Measure precision guard", () => {
  it("does not calculate physical distance from two-dimensional endpoint pixels", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).not.toContain("pixelToInch");
    expect(source).not.toContain("pixelToCm");
    expect(source).toContain("Native ARKit/LiDAR can replace this measurement engine later");
  });
});
