import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function walk(directory, predicate, output = []) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return output;
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(relative, predicate, output);
    else if (predicate(relative)) output.push(relative);
  }
  return output;
}

const pageFiles = walk("app", (file) => /page\.tsx$/.test(file));
const protectedPageFiles = pageFiles.filter((file) => file.startsWith(`app${path.sep}(app)${path.sep}`));
const sourceFiles = walk("app", (file) => /\.(tsx|ts|css)$/.test(file));

assert(pageFiles.length > 20, `Route inventory unexpectedly small (${pageFiles.length} pages).`);
assert(protectedPageFiles.length > 10, `Protected route inventory unexpectedly small (${protectedPageFiles.length} pages).`);

// Global overflow guard: viewport-width utility classes inside the application shell are a
// frequent cause of horizontal scrolling because the shell already consumes sidebar width.
for (const file of sourceFiles) {
  const source = read(file);
  if (/\b(?:w-screen|min-w-screen)\b/.test(source)) {
    failures.push(`${file}: avoid w-screen/min-w-screen inside B.O.S.; size against the containing workspace instead.`);
  }
}

const shell = read("app/(app)/app-shell.tsx");
assert(shell.includes('className="flex min-h-screen min-w-0"'), "App shell root must retain min-w-0 containment.");
assert(shell.includes('className="flex min-h-screen min-h-0 min-w-0 flex-1 flex-col"'), "Primary app content column must retain min-w-0 containment.");
assert(shell.includes("lg:hidden"), "App shell must retain the mobile navigation breakpoint.");
assert(shell.includes('aria-controls="bangoos-sidebar"'), "Mobile menu control must remain wired to the sidebar.");

const topCommandCss = read("app/top-command-layout.css");
assert(topCommandCss.includes("@media (min-width: 640px) and (max-width: 1023px)"), "Tablet/laptop top bar must keep its dedicated reflow breakpoint.");
assert(topCommandCss.includes("flex-direction: column !important"), "Tablet/laptop utilities must reflow instead of squeezing into one row.");
assert(topCommandCss.includes("overflow-x: auto"), "Top command navigation must remain horizontally scrollable when navigation is wider than the viewport.");
assert(topCommandCss.includes('grid-template-columns: 260px minmax(0, 1fr) !important'), "Tasks desktop layout must keep the Execution Board as the dominant column.");
assert(topCommandCss.includes('grid-column: 1 / -1'), "Tasks supporting panels must span a full row at ordinary desktop widths.");
assert(!topCommandCss.includes("min-width: 1800px"), "Do not restore the Tasks three-rail viewport assumption that caused Production compression.");

const executionBoard = read("components/projects/workspace/project-work-execution-board.tsx");
assert(executionBoard.includes('data-testid="execution-board-scroll-region"'), "Execution Board regression marker is missing.");
assert(/overflow-x-auto/.test(executionBoard), "Execution Board must preserve horizontal overflow handling for readable Kanban columns.");
assert(/min-w-\[1040px\]/.test(executionBoard), "Execution Board must preserve readable minimum Kanban width instead of compressing cards.");
assert(/min-w-0/.test(executionBoard), "Execution Board must retain min-w-0 containment.");

// Production-facing copy should not regress to the implementation placeholders cleaned up
// during this audit. Explicit coming-soon screens are excluded because they intentionally
// communicate unavailable modules.
const copyFiles = [
  "app/(app)/customers/page.tsx",
  "app/(app)/equipment/page.tsx",
  "app/(app)/operations/page.tsx",
  "app/(app)/settings/access-control/page.tsx",
].filter((file) => fs.existsSync(path.join(root, file)));
const forbiddenCopy = [
  /coming soon/i,
  /awaiting connection/i,
  /table (?:is|was|will be)/i,
  /schema (?:is|was|will be)/i,
  /service (?:is|was|will be) wired/i,
];
for (const file of copyFiles) {
  const source = read(file);
  for (const pattern of forbiddenCopy) {
    assert(!pattern.test(source), `${file}: Production-facing implementation/placeholder copy matched ${pattern}.`);
  }
}

console.log(`B.O.S. UI audit gate inventoried ${pageFiles.length} pages (${protectedPageFiles.length} authenticated workspace pages).`);

if (failures.length > 0) {
  console.error("\nB.O.S. UI audit gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("B.O.S. UI audit gate passed: shell containment, responsive command layout, Tasks board invariants, and Production-copy guards are intact.");
