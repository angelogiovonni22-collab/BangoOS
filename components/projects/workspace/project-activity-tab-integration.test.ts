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
const placeholderPath = path.join(process.cwd(), "components", "projects", "workspace", "project-command-center-tab-placeholder.tsx");
const projectPage = fs.readFileSync(projectPagePath, "utf8");
const placeholder = fs.readFileSync(placeholderPath, "utf8");

test("project activity tab routes through the workspace fallback branch", () => {
  assert(projectPage.includes('"activity"'), "Project page should register the activity workspace tab");
  assert(projectPage.includes("ProjectCommandCenterTabPlaceholder"), "Project page should retain the shared fallback branch");
});

test("activity fallback renders the existing activity intelligence workspace", () => {
  assert(placeholder.includes("ProjectActivityWorkspace"), "Fallback bridge should import ProjectActivityWorkspace");
  assert(placeholder.includes('tabParam === "activity"'), "Fallback bridge should recognize the activity tab");
  assert(placeholder.includes('tabParam === "timeline"'), "Fallback bridge should preserve the timeline alias");
  assert(placeholder.includes("currentUserId={activityIdentity.userId}"), "Activity workspace should receive current user id");
  assert(placeholder.includes("currentUserName={activityIdentity.userName}"), "Activity workspace should receive current user name");
});
