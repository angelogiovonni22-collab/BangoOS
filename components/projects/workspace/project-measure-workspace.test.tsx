import fs from "node:fs";
import path from "node:path";

describe("ProjectMeasureWorkspace", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");

  it("uses the environment-facing camera and never claims pixel distance is physical distance", () => {
    expect(source).toContain('facingMode: { ideal: "environment" }');
    expect(source).toContain("verified field dimension");
    expect(source).toContain("does not claim pixel distance is a physical measurement");
  });

  it("scopes saved measurement history to the project", () => {
    expect(source).toContain("`bos:measure:${projectId}`");
    expect(source).toContain("Measurement History");
  });
});
