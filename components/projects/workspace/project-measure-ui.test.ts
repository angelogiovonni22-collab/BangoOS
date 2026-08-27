import fs from "node:fs";
import path from "node:path";

describe("Measure UI", () => {
  it("provides camera, endpoint reset, save, and history controls", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    for (const text of ["Start Camera", "Stop Camera", "Reset points", "Save", "Measurement History"]) expect(source).toContain(text);
  });
});
