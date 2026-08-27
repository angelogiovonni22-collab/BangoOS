import fs from "node:fs";
import path from "node:path";

describe("Measure history", () => {
  it("caps local history and supports deletion", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain(".slice(0, 100)");
    expect(source).toContain("history.filter((row)=>row.id!==item.id)");
  });
});
