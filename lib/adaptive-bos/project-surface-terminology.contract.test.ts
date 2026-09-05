import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const projectTable = readFileSync("components/projects/project-table.tsx", "utf8");
const projectFilters = readFileSync("components/projects/project-filters.tsx", "utf8");

assert.match(projectTable, /useAdaptiveBos/, "Project directory must resolve Adaptive B.O.S. terminology");
assert.match(projectTable, /term\("project", "Project"\)/, "Project directory must resolve singular project terminology");
assert.match(projectTable, /term\("projects", "Projects"\)/, "Project directory must resolve plural project terminology");
assert.match(projectTable, /term\("customer", "Customer"\)/, "Project directory must resolve customer terminology");
assert.match(projectTable, /\{projectsLabel\}/, "Project lifecycle view must render the adaptive plural noun");
assert.match(projectTable, /title=\{`\$\{projectLabel\} Directory`\}/, "Project directory title must use adaptive terminology");
assert.doesNotMatch(projectTable, />\s*Projects\s*</, "Project directory must not hard-code the construction-default lifecycle label");

assert.match(projectFilters, /useAdaptiveBos/, "Project filters must resolve Adaptive B.O.S. terminology");
assert.match(projectFilters, /term\("project", "Project"\)/, "Project filters must resolve project terminology");
assert.match(projectFilters, /term\("customer", "Customer"\)/, "Project filters must resolve customer terminology");
assert.match(projectFilters, /\{customerLabel\}/, "Project customer filter must use adaptive terminology");
assert.match(projectFilters, /\{projectLabel\} Type/, "Project type filter must use adaptive terminology");

console.log("Adaptive B.O.S. project surface terminology contract passed.");
