import fs from "node:fs";
import path from "node:path";

describe("Measure mobile behavior", () => {
  it("uses inline playback and touch-safe endpoint selection", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("playsInline");
    expect(source).toContain("touch-none");
    expect(source).toContain("onPointerDown={selectPoint}");
  });
});
