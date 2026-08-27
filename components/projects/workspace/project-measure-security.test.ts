import fs from "node:fs";
import path from "node:path";

describe("Measure media lifecycle", () => {
  it("stops camera tracks on exit", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("getTracks().forEach((track) => track.stop())");
    expect(source).toContain("useEffect(() => stopCamera, [stopCamera])");
  });
});
