import fs from "node:fs";
import path from "node:path";

describe("Measure client boundary", () => {
  it("declares a client component for browser media APIs", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source.startsWith('"use client"')).toBe(true);
  });
});
