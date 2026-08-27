import fs from "node:fs";
import path from "node:path";

describe("Measure route boundary", () => {
  it("lives under the authenticated app project route", () => {
    expect(fs.existsSync(path.join(process.cwd(), "app/(app)/projects/[id]/measure/page.tsx"))).toBe(true);
  });
});
