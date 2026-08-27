import fs from "node:fs";
import path from "node:path";

describe("Measure units", () => {
  it("supports imperial inches and metric centimeters", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain('<option value="in">inches</option>');
    expect(source).toContain('<option value="cm">cm</option>');
  });
});
