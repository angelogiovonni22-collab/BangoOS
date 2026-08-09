import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const projectPagePath = path.join(process.cwd(), "app", "(app)", "projects", "[id]", "page.tsx");
const projectPage = fs.readFileSync(projectPagePath, "utf8");

test("project activity tab renders the existing activity intelligence workspace", () => {
  assert(projectPage.includes("ProjectActivityWorkspace"), "Project page should import ProjectActivityWorkspace");
  assert(projectPage.includes('activeTab === "activity"'), "Project page should branch on the activity tab");
  assert(projectPage.includes("currentUserId={workspace.workspaceContext.userId}"), "Activity workspace should receive current user id");
  assert(projectPage.includes("localeTag={localeTag}"), "Activity workspace should receive the resolved locale tag");
});
