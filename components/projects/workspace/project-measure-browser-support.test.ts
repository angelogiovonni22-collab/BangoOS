import fs from "node:fs";
import path from "node:path";

describe("Measure browser support", () => {
  it("guards getUserMedia availability and provides permission guidance", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("navigator.mediaDevices?.getUserMedia");
    expect(source).toContain("Allow Camera access for B.O.S.");
  });
});
