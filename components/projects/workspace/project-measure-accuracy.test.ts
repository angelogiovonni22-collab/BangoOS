import fs from "node:fs";
import path from "node:path";

describe("Measure input validation", () => {
  it("rejects missing endpoints and non-positive distances", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("!Number.isFinite(numericValue) || numericValue <= 0");
    expect(source).toContain("!firstPoint || !secondPoint");
  });
});
