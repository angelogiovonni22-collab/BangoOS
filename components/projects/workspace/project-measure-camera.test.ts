import fs from "node:fs";
import path from "node:path";

describe("Measure camera", () => {
  it("requests video without audio and cleans the stream", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "components/projects/workspace/project-measure-workspace.tsx"), "utf8");
    expect(source).toContain("audio: false");
    expect(source).toContain("track.stop()");
  });
});
